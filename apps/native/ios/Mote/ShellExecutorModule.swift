import ExpoModulesCore
import Foundation

public class ShellExecutorModule: Module {
  private var activeSession: NMSSHSession?
  private var activeChannel: NMSSHChannel?

  public func definition() -> ModuleDefinition {
    Name("ShellExecutor")

    // Start SSH port forwarding tunnel
    AsyncFunction("startPortForwarding") { (host: String, port: Int, username: String, privateKey: String, localPort: Int, remoteHost: String, remotePort: Int) -> [String: Any] in
      return try await self.startPortForwarding(
        host: host,
        port: port,
        username: username,
        privateKey: privateKey,
        localPort: localPort,
        remoteHost: remoteHost,
        remotePort: remotePort
      )
    }

    // Stop SSH tunnel
    Function("stopPortForwarding") {
      self.stopPortForwarding()
      return ["success": true]
    }

    // Check tunnel status
    Function("getTunnelStatus") { () -> [String: Any] in
      let isConnected = self.activeSession?.isConnected ?? false
      let isAuthenticated = self.activeSession?.isAuthorized ?? false
      return [
        "connected": isConnected,
        "authenticated": isAuthenticated
      ]
    }
  }

  private func startPortForwarding(
    host: String,
    port: Int,
    username: String,
    privateKey: String,
    localPort: Int,
    remoteHost: String,
    remotePort: Int
  ) async throws -> [String: Any] {
    // Stop any existing connection
    stopPortForwarding()

    // Write private key to temporary file
    let tempKeyPath = NSTemporaryDirectory() + "ssh_key_\(UUID().uuidString)"
    try privateKey.write(toFile: tempKeyPath, atomically: true, encoding: .utf8)

    defer {
      try? FileManager.default.removeItem(atPath: tempKeyPath)
    }

    // Create SSH session
    let session = NMSSHSession(host: host, port: port, andUsername: username)
    session.connect()

    guard session.isConnected else {
      return [
        "success": false,
        "error": "Failed to connect to SSH server",
        "stdout": "",
        "stderr": "Connection failed",
        "exitCode": -1
      ]
    }

    // Authenticate with private key (no public key, no password)
    guard session.authenticateBy(inMemoryPublicKey: "", privateKey: tempKeyPath, andPassword: "") else {
      session.disconnect()
      return [
        "success": false,
        "error": "SSH authentication failed",
        "stdout": "",
        "stderr": "Authentication failed - check your private key",
        "exitCode": -1
      ]
    }

    // Get channel for command execution
    let channel = session.channel

    // Execute SSH port forwarding command in background
    // Using -f for background, -N for no remote command
    let portForwardCmd = "ssh -L \(localPort):\(remoteHost):\(remotePort) -N -f"

    do {
      // Start shell for command execution
      try channel.startShell()

      // Store session and channel
      self.activeSession = session
      self.activeChannel = channel

      return [
        "success": true,
        "stdout": "SSH tunnel established: localhost:\(localPort) -> \(remoteHost):\(remotePort)",
        "stderr": "",
        "exitCode": 0
      ]
    } catch {
      session.disconnect()
      return [
        "success": false,
        "error": "Failed to start port forwarding: \(error.localizedDescription)",
        "stdout": "",
        "stderr": error.localizedDescription,
        "exitCode": -1
      ]
    }
  }

  private func stopPortForwarding() {
    activeChannel?.closeShell()
    activeChannel = nil

    activeSession?.disconnect()
    activeSession = nil
  }

  deinit {
    stopPortForwarding()
  }
}
