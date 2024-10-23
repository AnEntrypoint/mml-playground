import fs from "fs";
import path from "path";
import url from "url";

import { Networked3dWebExperienceServer } from "@mml-io/3d-web-experience-server";
import { CharacterDescription } from "@mml-io/3d-web-user-networking";
import dotenv from "dotenv";
import express from "express";
import enableWs from "express-ws";

import { BasicUserAuthenticator } from "./BasicUserAuthenticator";
import { ReactMMLDocumentServer } from "./ReactMMLDocumentServer";

dotenv.config();

const dirname = url.fileURLToPath(new URL(".", import.meta.url));
const PORT = process.env.PORT || 8080;
const webClientBuildDir = path.join(dirname, "../../web-client/build/");
const assetsDir = path.join(dirname, "../../assets/");
const indexContent = fs.readFileSync(path.join(webClientBuildDir, "index.html"), "utf8");
const MML_DOCUMENT_PATH = path.join(dirname, "../../playground/build/index.js");
const examplesWatchPath = path.resolve(path.join(dirname, "../examples"), "*.html");

// Specify the avatar to use here:
const characterDescription: CharacterDescription = {
  // Option 1 (Default) - Use a GLB file directly
  meshFileUrl: "https://mmlstorage.com/cIzlm5/1729698857259.html", // This is just an address of a GLB file
  // Option 2 - Use an MML Character from a URL
  // mmlCharacterUrl: "https://...",
  // Option 3 - Use an MML Character from a string
  // mmlCharacterString: `
  // <m-character src="/assets/models/bot.glb">
  //   <m-model src="/assets/models/hat.glb"
  //     socket="head"
  //     x="0.03" y="0" z="0.0"
  //     sx="1.03" sy="1.03" sz="1.03"
  //     rz="-90"
  //   ></m-model>
  // </m-character>
  // `,
};
const userAuthenticator = new BasicUserAuthenticator(characterDescription, {
  /*
   This option allows sessions that are reconnecting from a previous run of the server to connect even if the present a
   session token that was not generated by this run of the server.

   This is useful for development, but in deployed usage, it is recommended to set this to false.
  */
  devAllowUnrecognizedSessions: true,
});

const { app } = enableWs(express());
app.enable("trust proxy");

const reactMMLDocumentServer = new ReactMMLDocumentServer({
  mmlDocumentPath: MML_DOCUMENT_PATH,
  useWss: process.env.NODE_ENV === "production" || process.env.CODESANDBOX_HOST !== undefined,
});

// Handle playground document sockets
app.ws("/playground", (ws) => {
  reactMMLDocumentServer.handle(ws);
});

const networked3dWebExperienceServer = new Networked3dWebExperienceServer({
  networkPath: "/network",
  userAuthenticator,
  mmlServing: {
    documentsWatchPath: examplesWatchPath,
    documentsUrl: "/examples/",
  },
  webClientServing: {
    indexUrl: "/",
    indexContent,
    clientBuildDir: webClientBuildDir,
    clientUrl: "/web-client/",
    clientWatchWebsocketPath:
      process.env.NODE_ENV !== "production" ? "/web-client-build" : undefined,
  },
  chatNetworkPath: "/chat-network",
  assetServing: {
    assetsDir,
    assetsUrl: "/assets/",
  },
});
networked3dWebExperienceServer.registerExpressRoutes(app);

// Start listening
console.log("Listening on port", PORT);
app.listen(PORT);
