// swift-tools-version: 5.10
import PackageDescription
let package = Package(
    name: "MacOSScanner",
    platforms: [.macOS(.v13)],
    products: [.executable(name: "macos-scanner", targets: ["MacOSScanner"])],
    targets: [.executableTarget(name: "MacOSScanner", linkerSettings: [.linkedFramework("ImageCaptureCore")])]
)
