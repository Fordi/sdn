#!/usr/bin/env node
import { isMain } from "../lib/isMain.js";
import { control } from "./control.js";

if (isMain(import.meta.url)) {
  control(['status']);
}
