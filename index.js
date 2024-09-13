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
 * @returns {Promise<[import("@atproto/api").AppBskyActorDefs.ProfileView[], import("@atproto/api").AppBskyActorDefs.ProfileView[]]>
 */
async function getFollowersAndFollowing() {
    const { data: followersData } = await agent.getFollowers({ actor: agent.did })
    const { data: followingData } = await agent.getFollows({ actor: agent.did })

    return [followersData.followers, followingData.follows]
}

await askUserPDS()
await promptSessionStart()
const [followers, follows] = await getFollowersAndFollowing()

for (const follow of follows) {
    const foundRelatedFollower = followers.find((follower) => follower.did === follow.did) // Find by DID

    if (foundRelatedFollower) continue; // skip for now

    console.log("Found NonMutual Follow:", follow.displayName ?? "@" + follow.handle)
}
