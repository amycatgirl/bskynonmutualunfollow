import readline from "node:readline";
import { promisify } from "node:util";
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
})

/**
 * Get input from `stdin`
 * @param {string} query
 * @returns {Promise<string>}
 */
export const input = promisify(rl.question).bind(rl)

