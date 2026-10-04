import { DesktopApi } from '../shared/desktop-contracts';
declare global {
  interface Window {
    desktop: DesktopApi['desktop'];
    files: DesktopApi['files'];
    scanner: DesktopApi['scanner'];
  }
}
