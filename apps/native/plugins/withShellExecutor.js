/**
 * Expo Config Plugin: Shell Executor
 *
 * Adds native code for executing shell commands on iOS and Android.
 * This enables SSH tunnel port forwarding functionality.
 */

const { withDangerousMod, IOSConfig, AndroidConfig } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Add Android native code for shell execution
 */
function withShellExecutorAndroid(config) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const packageName = 'studio.nebaura.mote'; // Match app.json android.package
      const packagePath = packageName.replace(/\./g, '/');

      const mainApplicationPath = path.join(
        projectRoot,
        'android',
        'app',
        'src',
        'main',
        'java',
        packagePath,
        'ShellExecutorModule.kt'
      );

      // Create Kotlin module for shell execution
      const kotlinCode = `package ${packageName}

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.BufferedReader
import java.io.InputStreamReader

class ShellExecutorModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ShellExecutor")

    AsyncFunction("executeCommand") { command: String ->
      return@AsyncFunction executeShellCommand(command)
    }
  }

  private suspend fun executeShellCommand(command: String): Map<String, Any> = withContext(Dispatchers.IO) {
    try {
      val process = Runtime.getRuntime().exec(arrayOf("/system/bin/sh", "-c", command))

      val stdout = BufferedReader(InputStreamReader(process.inputStream)).use { it.readText() }
      val stderr = BufferedReader(InputStreamReader(process.errorStream)).use { it.readText() }

      val exitCode = process.waitFor()

      mapOf(
        "stdout" to stdout,
        "stderr" to stderr,
        "exitCode" to exitCode
      )
    } catch (e: Exception) {
      mapOf(
        "stdout" to "",
        "stderr" to e.message.orEmpty(),
        "exitCode" to -1
      )
    }
  }
}
`;

      // Write the module file
      await fs.promises.mkdir(path.dirname(mainApplicationPath), { recursive: true });
      await fs.promises.writeFile(mainApplicationPath, kotlinCode);

      return config;
    },
  ]);
}

/**
 * Add iOS native code for shell execution
 */
function withShellExecutorIOS(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;

      const modulePath = path.join(
        projectRoot,
        'ios',
        'ShellExecutorModule.swift'
      );

      // Create Swift module for shell execution
      const swiftCode = `import ExpoModulesCore

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
`;

      // Write the module file
      await fs.promises.writeFile(modulePath, swiftCode);

      return config;
    },
  ]);
}

module.exports = function withShellExecutor(config) {
  config = withShellExecutorAndroid(config);
  config = withShellExecutorIOS(config);
  return config;
};
