package studio.nebaura.mote

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
