import { AtpAgent } from "@atproto/api";
import { input } from "./common/stdio.js";
import { inspect } from "node:util";

/**
 * @type {import("@atproto/api").AtpAgent}
 */
let agent;

async function askUserPDS() {
    /** @type {string} */
    const output = await input("PDS URL: ") ?? "https://bsky.social" // Default to BSKY AppService;

    agent = new AtpAgent({
        service: output
    })
}

async function promptSessionStart() {
    const identifier = await input("Identifier: ")
    const password = await input("Password: ")
    if (!identifier || !password) throw new Error("Missing identifier and/or Password")

    await agent.login({
        identifier,
        password
    })

    const { data: profileData } = await agent.getProfile({ actor: agent.did })

    console.info(`Logged in as ${profileData.displayName ?? profileData.handle} ${profileData.displayName && `(@${profileData.handle})`}`)
    console.info(`Followers: ${profileData.followersCount} | Following: ${profileData.followsCount}`)
}

/**
 * Get user's follows and followers, returns a tuple.
 * @returns {Promise<(object, object)>}
 */
async function getFollowersAndFollowing() {
    const { data: followersData } = await agent.getFollowers({ actor: agent.did })
    const { data: followingData } = await agent.getFollows({ actor: agent.did })

    console.log(inspect(followersData))
    console.log(inspect(followingData))

    return [followersData, followingData]
}

await askUserPDS()
await promptSessionStart()
const [followers, follows] = await getFollowersAndFollowing()
