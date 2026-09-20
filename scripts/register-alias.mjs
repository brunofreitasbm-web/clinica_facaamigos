// scripts/register-alias.mjs — usar com `node --import ./scripts/register-alias.mjs <script.ts>`.
import { register } from "node:module";

register("./alias-loader.mjs", import.meta.url);
