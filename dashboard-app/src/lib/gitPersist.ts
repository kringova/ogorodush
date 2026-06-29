import { execFileSync } from "node:child_process";
import { VAULT_PATH } from "./vault";

/**
 * Добавить файлы в git, закоммитить, подтянуть (rebase) и запушить.
 *
 * Гейт: process.env.INBOX_GIT_PUSH — тот же флаг, что используется в inbox-роуте.
 * Работает в проде на VPS; локально (без флага) возвращает false и ничего не делает.
 *
 * На ошибке — console.error и возвращает false.
 * Файл уже на диске — потеря пуша не критична.
 */
export function gitPersist(relPaths: string[], message: string): boolean {
  if (!process.env.INBOX_GIT_PUSH) return false;
  try {
    const git = (...args: string[]) =>
      execFileSync("git", args, { cwd: VAULT_PATH, stdio: "pipe" });
    git("add", ...relPaths);
    git("commit", "-m", message);
    git("pull", "--rebase", "--autostash");
    git("push");
    return true;
  } catch (e) {
    console.error("gitPersist failed:", e);
    return false;
  }
}
