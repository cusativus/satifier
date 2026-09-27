const notifier = require('node-notifier');
const path = require("node:path");
const Website = require("./web/Website");
const NotificationCenter = require('node-notifier/notifiers/notificationcenter');
const ModrinthClass = require("./modrinth/modrinth");
const RobloxClass = require("./roblox/roblox");
const MemorySystem = require("./memory/MemorySystem");
const sharp = require("sharp");
const ico = require('sharp-ico');
const fs = require("node:fs");
const config = require("./config.json");

/**
 * 
 * @param {NotificationCenter.Notification} notif 
 */
function notify(notif) {
    notifier.notify({
        ...notif,
        icon: path.join(__dirname, "assets/icon.png")
    });
}

async function generateIcoFile() {
    const IconAsset = fs.readFileSync("./assets/icon.png");
    const pngBuffer = await sharp(IconAsset)
        .resize(256, 256, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .toFormat('png')
        .toBuffer();
    const icoBuffer = ico.encode([pngBuffer]);
    fs.writeFileSync("./web/favicon.ico", icoBuffer);
}

async function start() {
    const Modrinth = new ModrinthClass();
    const Roblox = new RobloxClass();
    await Website.init();
    await generateIcoFile();
    if (config.rblxApiKey == "")
        throw new Error("No API key was provided for roblox; this is integral! (Define this in config.json)");
    await Roblox.checkApiKey();
    notify({
        title: "Notifier is ready",
        message: "Check console for directions!"
    });
    console.log(`Navigate to "http://localhost:${config.port}/web/home" in your browser to open the control panel`);
    Website.command(async (id, body) => {
        switch (id) {
            case "notify":
                notify({
                    title: "test",
                    message: "this is a test"
                });
                break;
            case "modrinth-add":
                var result = await Modrinth.add(body.slug);
                if (result.error != undefined) {
                    return {
                        status: 404,
                        response: result.error
                    };
                }
                break;
            case "roblox-add":
                var result = await Roblox.addGameFromPlaceId(body.placeid);
                if (result.error != undefined) {
                    return {
                        status: 404,
                        response: result.error
                    };
                }
                break;
            default:
                return {
                    status: 404,
                    response: `No command exists for id ${id}`
                };
        }
        return {
            status: 200,
            response: 'OK'
        };
    });
    Modrinth.on("update", updates => {
        updates.forEach((id) => {
            const modData = MemorySystem.readJson(`modrinth/mods/${id}`);
            notify({
                title: `${modData.name} updated`,
                message: `Updated at ${new Date(modData.lastUpdate).toDateString()}`
            });
        })
    });
    Roblox.on("stateChange", stateChanges => {
        for (let i = 0; i < stateChanges.length; i++) {
            const stateChangeData = stateChanges[i];
            const fileData = MemorySystem.readJson(`roblox/${stateChangeData.universeId}/${stateChangeData.eventId}`);
            switch (stateChangeData.state) {
                case "1HourStart":
                    notify({
                        title: `${fileData.universeName}: ${fileData.eventName}`,
                        message: "Starts in 1 hour"
                    });
                    break;
                case "Start":
                    notify({
                        title: `${fileData.universeName}: ${fileData.eventName}`,
                        message: "Just started"
                    });
                    break;
                case "1HourEnd":
                    notify({
                        title: `${fileData.universeName}: ${fileData.eventName}`,
                        message: "Ends in 1 hour"
                    });
                    break;
                case "End":
                    notify({
                        title: `${fileData.universeName}: ${fileData.eventName}`,
                        message: "Just ended"
                    });
                    break;
            }
        }
    });
    Roblox.on("eventAdded", event => {
        console.log(`detected new event`);
        notify({
            title: event.universeName,
            message: `Now Tracking: ${event.eventName}`
        });
    });
    Roblox.on("gameUpdated", data => {
        console.log(`${data.displayName} updated`);
        notify({
            title: `${data.displayName} Updated`,
            message: `${new Date(data.updateTime).toDateString()} @ ${new Date(data.updateTime).toTimeString()}`
        });
    });
    Roblox.on("eventChanged", event => {
        console.log(`${event.universeName}: ${event.eventName} changed`);
        notify({
            title: event.universeName,
            message: `${event.eventName} was changed`
        });
    });
    Roblox.on("error", err => {
        notify({
            title: `RBLX Error`,
            message: JSON.stringify(err)
        });
    });
    Modrinth.init();
    Roblox.init();
}

try {
    start();
} catch (err) {
    notify({
        title: "Error Occurred",
        message: "check logs"
    });
    setTimeout(() => {throw err;}, 1000);
}