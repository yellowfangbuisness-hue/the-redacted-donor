import Cocoa
import WebKit
import CoreGraphics

@main
struct RedactedDonor {
    @MainActor static func main() {
        let app = NSApplication.shared
        let delegate = GameWindow()
        app.delegate = delegate
        app.setActivationPolicy(.regular)
        withExtendedLifetime(delegate) { app.run() }
    }
}

@MainActor
final class GameWindow: NSObject, NSApplicationDelegate, NSWindowDelegate, WKScriptMessageHandler, WKNavigationDelegate {
    private var window: NSWindow!
    private var view: WKWebView!
    private var mouseMonitor: Any?
    private var captured = false
    private var delta = CGPoint.zero
    private var queued = false
    private var gameURL: URL!

    func applicationDidFinishLaunching(_ notification: Notification) {
        let config = WKWebViewConfiguration()
        config.userContentController.add(self, name: "gameMouse")
        let frame = NSScreen.main?.visibleFrame ?? NSRect(x: 0, y: 0, width: 1280, height: 800)
        let size = NSMakeRect(0, 0, min(1440, frame.width * 0.92), min(880, frame.height * 0.90))
        window = NSWindow(contentRect: size, styleMask: [.titled, .closable, .resizable, .miniaturizable], backing: .buffered, defer: false)
        window.title = "The Redacted Donor"
        window.backgroundColor = NSColor(calibratedRed: 0.09, green: 0.07, blue: 0.05, alpha: 1)
        window.titlebarAppearsTransparent = true
        window.minSize = NSSize(width: 680, height: 410)
        window.acceptsMouseMovedEvents = true
        window.collectionBehavior.insert(.fullScreenPrimary)
        window.delegate = self
        view = WKWebView(frame: size, configuration: config)
        view.navigationDelegate = self
        view.allowsMagnification = false
        window.contentView = view
        window.center()
        window.makeKeyAndOrderFront(nil)
        window.makeFirstResponder(view)
        NSApp.appearance = NSAppearance(named: .darkAqua)
        let bar = NSMenu(); let appItem = NSMenuItem(); bar.addItem(appItem)
        let appMenu = NSMenu(); appItem.submenu = appMenu
        appMenu.addItem(withTitle: "Quit The Redacted Donor", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        let viewItem = NSMenuItem(); bar.addItem(viewItem); let menu = NSMenu(title: "View"); viewItem.submenu = menu
        let fs = menu.addItem(withTitle: "Toggle Full Screen", action: #selector(NSWindow.toggleFullScreen(_:)), keyEquivalent: "f")
        fs.keyEquivalentModifierMask = [.control, .command]
        NSApp.mainMenu = bar
        gameURL = Bundle.main.url(forResource: "index", withExtension: "html")
        guard let gameURL else { NSApp.terminate(nil); return }
        view.loadFileURL(gameURL, allowingReadAccessTo: gameURL)
        NSApp.activate(ignoringOtherApps: true)
        mouseMonitor = NSEvent.addLocalMonitorForEvents(matching: [.mouseMoved, .leftMouseDragged]) { [weak self] event in
            guard let self, self.captured, event.window === self.window else { return event }
            self.delta.x += event.deltaX; self.delta.y += event.deltaY
            self.sendMovement()
            return nil
        }
    }

    private func sendMovement() {
        guard !queued, captured, delta != .zero else { return }
        let x = delta.x, y = delta.y
        delta = .zero; queued = true
        view.evaluateJavaScript("window.gameMouseDelta?.(\(x),\(y))") { [weak self] _, _ in
            guard let self else { return }
            self.queued = false; self.sendMovement()
        }
    }

    private func setCapture(_ enable: Bool) {
        guard enable != captured else { return }
        captured = enable; delta = .zero
        if enable {
            let center = window.convertPoint(toScreen: NSPoint(x: window.frame.width / 2, y: window.contentLayoutRect.height / 2))
            let top = NSScreen.screens.first?.frame.maxY ?? 0
            CGWarpMouseCursorPosition(CGPoint(x: center.x, y: top - center.y))
            CGAssociateMouseAndMouseCursorPosition(0)
            NSCursor.hide()
        } else {
            CGAssociateMouseAndMouseCursorPosition(1)
            NSCursor.unhide()
        }
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "gameMouse", message.frameInfo.isMainFrame, message.frameInfo.request.url?.isFileURL == true else { return }
        setCapture((message.body as? String) == "capture" && window.isKeyWindow)
    }
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let resource = navigationAction.request.url else { decisionHandler(.cancel); return }
        if resource.standardizedFileURL == gameURL.standardizedFileURL { decisionHandler(.allow); return }
        if navigationAction.navigationType == .linkActivated, resource.scheme == "https", resource.host == "www.declarationofistanbul.org" { NSWorkspace.shared.open(resource) }
        decisionHandler(.cancel)
    }
    func windowDidResignKey(_ notification: Notification) { setCapture(false) }
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }
    func applicationWillTerminate(_ notification: Notification) {
        setCapture(false)
        if let mouseMonitor { NSEvent.removeMonitor(mouseMonitor) }
    }
}
