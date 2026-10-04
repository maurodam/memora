import Foundation
import ImageCaptureCore
import UniformTypeIdentifiers

// stdout is a JSON Lines transport. All scanner operations run on the main run loop.
final class ScannerHelper: NSObject, ICDeviceBrowserDelegate, ICScannerDeviceDelegate {
    private let browser = ICDeviceBrowser()
    private let initializedAt = Date()
    private var scanners: [String: ICScannerDevice] = [:]
    private var capabilities: [String: [String: Any]] = [:]
    private var inspecting = Set<String>()
    private var closing = Set<String>()
    private var scanRequest: [String: Any]?
    private var activeScanner: ICScannerDevice?
    private var started = false
    private var cancelled = false
    private var resultURL: URL?
    private var scanTimer: Timer?
    private var listRequests = Set<String>()

    override init() {
        super.init()
        browser.delegate = self
        browser.browsedDeviceTypeMask = ICDeviceTypeMask(rawValue: ICDeviceTypeMask.scanner.rawValue | ICDeviceLocationTypeMask.local.rawValue | ICDeviceLocationTypeMask.shared.rawValue)!
        browser.start()
    }
    func reply(_ requestId: String, _ content: [String: Any]) {
        var response = content; response["requestId"] = requestId
        guard let data = try? JSONSerialization.data(withJSONObject: response, options: [.sortedKeys]) else { return }
        FileHandle.standardOutput.write(data); FileHandle.standardOutput.write(Data([10]))
    }
    func fail(_ requestId: String, _ code: String, _ message: String) { reply(requestId, ["success": false, "code": code, "message": message]) }
    private func identifier(_ device: ICDevice) -> String? { device.uuidString }
    func command(_ input: [String: Any]) {
        guard let id = input["requestId"] as? String, let command = input["command"] as? String else { return }
        switch command {
        case "listDevices":
            guard scanRequest == nil else { fail(id, "BUSY", "Attendi la fine della scansione."); return }
            // Reinspect devices whose previous session was busy or capabilities were unavailable.
            for (key, scanner) in scanners where capabilities[key] == nil && !inspecting.contains(key) { inspect(scanner, key) }
            listRequests.insert(id)
            let began = Date()
            func deliver() {
                guard self.listRequests.contains(id) else { return }
                if Date().timeIntervalSince(self.initializedAt) < 2 || (!self.inspecting.isEmpty && Date().timeIntervalSince(began) < 10) {
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.25, execute: deliver); return
                }
                self.listRequests.remove(id)
                self.reply(id, ["success": true, "devices": self.capabilities.values.sorted { ($0["name"] as? String ?? "") < ($1["name"] as? String ?? "") }])
            }
            deliver()
        case "scan":
            guard scanRequest == nil else { fail(id, "BUSY", "Una scansione è già in corso."); return }
            guard let deviceId = input["deviceId"] as? String, let scanner = scanners[deviceId] else { fail(id, "SCANNER_UNAVAILABLE", "Scanner non disponibile o scollegato."); return }
            guard let dpi = input["dpi"] as? Int, [300, 600].contains(dpi), let format = input["format"] as? String, ["jpeg", "png"].contains(format),
                  let destination = input["destination"] as? String, destination.hasPrefix("/"), FileManager.default.fileExists(atPath: destination) else {
                fail(id, "INVALID_INPUT", "Parametri di scansione non validi."); return
            }
            guard scanner.availableFunctionalUnitTypes.contains(NSNumber(value: ICScannerFunctionalUnitType.flatbed.rawValue)) else { fail(id, "UNSUPPORTED", "Questo scanner non dispone di un piano flatbed."); return }
            scanRequest = input; activeScanner = scanner; started = false; cancelled = false; resultURL = nil
            scanTimer = Timer.scheduledTimer(withTimeInterval: 290, repeats: false) { _ in
                scanner.cancelScan(); self.finishError("SCANNER_TIMEOUT", "Lo scanner non risponde. Riprova la scansione.")
            }
            if !closing.contains(deviceId) {
                if scanner.hasOpenSession { scanner.requestSelect(.flatbed) } else { scanner.requestOpenSession() }
            }
        case "cancel":
            guard scanRequest != nil else { reply(id, ["success": true]); return }
            cancelled = true
            activeScanner?.cancelScan()
            // Keep the operation locked until its completion delegate, or the timeout, runs.
            if !started { finishCancelled() }
            reply(id, ["success": true])
        default: fail(id, "UNKNOWN_COMMAND", "Comando non supportato.")
        }
    }
    private func inspect(_ scanner: ICScannerDevice, _ id: String) {
        guard scanner.availableFunctionalUnitTypes.contains(NSNumber(value: ICScannerFunctionalUnitType.flatbed.rawValue)) else { return }
        inspecting.insert(id); scanner.delegate = self
        if scanner.hasOpenSession { scanner.requestSelect(.flatbed) } else { scanner.requestOpenSession() }
    }
    func deviceBrowser(_ browser: ICDeviceBrowser, didAdd device: ICDevice, moreComing: Bool) {
        guard let scanner = device as? ICScannerDevice, let id = identifier(scanner) else { return }
        scanners[id] = scanner; inspect(scanner, id)
    }
    func deviceBrowser(_ browser: ICDeviceBrowser, didRemove device: ICDevice, moreGoing: Bool) { remove(device) }
    func didRemove(_ device: ICDevice) { remove(device) }
    private func remove(_ device: ICDevice) {
        if let id = identifier(device) { scanners.removeValue(forKey: id); capabilities.removeValue(forKey: id); inspecting.remove(id) }
        if device === activeScanner { finishError("SCANNER_DISCONNECTED", "Scanner scollegato durante la scansione.") }
    }
    func device(_ device: ICDevice, didOpenSessionWithError error: Error?) {
        guard let scanner = device as? ICScannerDevice else { return }
        if error != nil {
            if let id = identifier(device) { inspecting.remove(id) }
            if device === activeScanner { finishError("SESSION_FAILED", "Impossibile aprire lo scanner. Controlla permessi macOS e altre applicazioni di scansione.") }
            return
        }
        scanner.requestSelect(.flatbed)
    }
    func device(_ device: ICDevice, didCloseSessionWithError error: Error?) {
        let wasClosing = identifier(device).map { closing.remove($0) != nil } ?? false
        if device === activeScanner && scanRequest != nil {
            if wasClosing && !started && error == nil { device.requestOpenSession() }
            else { finishError("SESSION_CLOSED", "Sessione scanner interrotta.") }
        }
    }
    func deviceDidBecomeReady(_ device: ICDevice) {
        guard let scanner = device as? ICScannerDevice else { return }
        if scanner.selectedFunctionalUnit.type == .flatbed { prepare(scanner, scanner.selectedFunctionalUnit) }
    }
    func scannerDevice(_ scanner: ICScannerDevice, didSelect functionalUnit: ICScannerFunctionalUnit, error: Error?) {
        if error != nil || functionalUnit.type != .flatbed {
            if let id = identifier(scanner) { inspecting.remove(id) }
            if scanner === activeScanner { finishError("UNSUPPORTED", "Piano flatbed non disponibile.") }
            return
        }
        prepare(scanner, functionalUnit)
    }
    private func prepare(_ scanner: ICScannerDevice, _ unit: ICScannerFunctionalUnit) {
        guard scanner.hasOpenSession else { return }
        let resolutions = [300, 600].filter { unit.supportedResolutions.contains($0) }
        if let id = identifier(scanner) {
            capabilities[id] = ["id": id, "name": scanner.name ?? "Scanner macOS", "resolutions": resolutions, "formats": ["jpeg", "png"]]
            inspecting.remove(id)
        }
        guard scanner === activeScanner, let request = scanRequest else { closeSession(scanner); return }
        guard !started else { return }
        if cancelled { finishCancelled(); return }
        guard let dpi = request["dpi"] as? Int, resolutions.contains(dpi) else { finishError("UNSUPPORTED_DPI", "Risoluzione non supportata dallo scanner."); return }
        let size = unit.physicalSize
        guard size.width > 0 && size.height > 0 else { finishError("INVALID_SCAN_AREA", "Lo scanner non ha comunicato un’area di scansione valida."); return }
        unit.pixelDataType = .RGB
        if unit.supportedBitDepths.contains(8) { unit.bitDepth = ICScannerBitDepth(rawValue: 8)! }
        unit.resolution = dpi
        unit.scanArea = CGRect(origin: .zero, size: size)
        scanner.transferMode = .fileBased
        scanner.downloadsDirectory = URL(fileURLWithPath: request["destination"] as! String, isDirectory: true)
        scanner.documentName = "scan"
        scanner.documentUTI = request["format"] as? String == "png" ? UTType.png.identifier : UTType.jpeg.identifier
        started = true; scanner.requestScan()
    }
    func scannerDevice(_ scanner: ICScannerDevice, didScanTo url: URL) { if scanner === activeScanner { resultURL = url } }
    func scannerDevice(_ scanner: ICScannerDevice, didCompleteScanWithError error: Error?) {
        guard scanner === activeScanner, let request = scanRequest, let id = request["requestId"] as? String else { return }
        if cancelled { finishCancelled(); return }
        if error != nil { finishError("SCAN_FAILED", "Scansione non riuscita. Controlla scanner e permessi macOS."); return }
        guard let url = resultURL else { finishError("NO_IMAGE", "Lo scanner non ha restituito un’immagine."); return }
        reply(id, ["success": true, "filePath": url.path]); clearOperation()
    }
    func device(_ device: ICDevice, didEncounterError error: Error?) {
        if device === activeScanner { finishError("SCANNER_ERROR", "Errore scanner. Controlla collegamento e permessi macOS.") }
    }
    private func finishError(_ code: String, _ message: String) {
        guard let id = scanRequest?["requestId"] as? String else { return }
        reply(id, ["success": false, "code": code, "message": message]); clearOperation()
    }
    private func finishCancelled() {
        guard let id = scanRequest?["requestId"] as? String else { return }
        reply(id, ["success": true, "cancelled": true]); clearOperation()
    }
    private func clearOperation() {
        scanTimer?.invalidate(); scanTimer = nil
        let scanner = activeScanner; activeScanner = nil; scanRequest = nil; resultURL = nil; started = false
        if let scanner = scanner, scanner.hasOpenSession { closeSession(scanner) }
    }
    private func closeSession(_ scanner: ICScannerDevice) {
        if let id = identifier(scanner) { closing.insert(id) }
        scanner.requestCloseSession()
    }
    func shutdown() { activeScanner?.cancelScan(); for scanner in scanners.values where scanner.hasOpenSession { scanner.requestCloseSession() }; browser.stop() }
}

let helper = ScannerHelper()
var inputBuffer = Data()
FileHandle.standardInput.readabilityHandler = { handle in
    let chunk = handle.availableData
    if chunk.isEmpty { DispatchQueue.main.async { helper.shutdown(); exit(0) }; return }
    inputBuffer.append(chunk)
    if inputBuffer.count > 1_048_576 { FileHandle.standardError.write(Data("Input exceeds protocol limit\n".utf8)); exit(1) }
    while let newline = inputBuffer.firstIndex(of: 10) {
        let line = inputBuffer.prefix(upTo: newline); inputBuffer.removeSubrange(...newline)
        guard let input = try? JSONSerialization.jsonObject(with: line) as? [String: Any] else { FileHandle.standardError.write(Data("Invalid JSON input\n".utf8)); continue }
        DispatchQueue.main.async { helper.command(input) }
    }
}
RunLoop.main.run()
