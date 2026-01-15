import ExpoModulesCore

public class ShellExecutorModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ShellExecutor")

    AsyncFunction("executeCommand") { (command: String) in
      return try await executeShellCommand(command: command)
    }
  }

  private func executeShellCommand(command: String) async throws -> [String: Any] {
    let task = Process()
    task.launchPath = "/bin/sh"
    task.arguments = ["-c", command]

    let outputPipe = Pipe()
    let errorPipe = Pipe()

    task.standardOutput = outputPipe
    task.standardError = errorPipe

    do {
      try task.run()
      task.waitUntilExit()

      let outputData = outputPipe.fileHandleForReading.readDataToEndOfFile()
      let errorData = errorPipe.fileHandleForReading.readDataToEndOfFile()

      let stdout = String(data: outputData, encoding: .utf8) ?? ""
      let stderr = String(data: errorData, encoding: .utf8) ?? ""

      return [
        "stdout": stdout,
        "stderr": stderr,
        "exitCode": Int(task.terminationStatus)
      ]
    } catch {
      return [
        "stdout": "",
        "stderr": error.localizedDescription,
        "exitCode": -1
      ]
    }
  }
}
