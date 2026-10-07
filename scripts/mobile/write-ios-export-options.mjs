import { writeFileSync } from "node:fs";
import {
  validateReleaseConfig,
  loadMobileEnv,
} from "./check-release-config.mjs";
loadMobileEnv();
const config = validateReleaseConfig(process.env);
const profile = process.env.GIYAHERO_PROFILE_UUID;
if (!profile || !/^[0-9A-Fa-f-]{36}$/.test(profile) || !process.argv[2])
  throw new Error("Supply provisioning profile UUID and output plist path.");
const xml =
  '<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>method</key><string>app-store-connect</string><key>teamID</key><string>' +
  config.teamId +
  "</string><key>signingStyle</key><string>manual</string><key>provisioningProfiles</key><dict><key>" +
  config.appId +
  "</key><string>" +
  profile +
  "</string></dict></dict></plist>";
writeFileSync(process.argv[2], xml);
