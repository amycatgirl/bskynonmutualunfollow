import { AtpAgent, CredentialSession } from "@atproto/api";
import { input } from "./common/stdio.js";
import { inspect } from "node:util";
import { writeFile, open, stat } from "node:fs/promises";
import { delay } from "./common/delay.js";

import readlineSync from "readline-sync";

/**
 * @type {import("@atproto/api").AtpAgent}
 */
let agent;
async function promptSessionStart() {
  const service = await input("Service (If unsure, use https://bsky.social): ");
  agent = new AtpAgent({
    service,
    persistSession: async (ev, session) => {
      console.log("Saving session to bskysession.json...");
      await writeFile("bskysession.json", JSON.stringify(session)).then(() =>
        console.log("Done!")
      );
    },
  });
  const sessionExists = await stat("bskysession.json")
    .then(() => true)
    .catch(() => false);

  if (sessionExists) {
    console.log("Found session! Resuming...");
    const sessionDataFile = await open("bskysession.json");
    const data = JSON.parse(
      await sessionDataFile.readFile({ encoding: "utf8" })
    );

    // Close the file as this information isn't needed anymore
    await sessionDataFile.close();
    await agent.resumeSession(data);
  } else {
    const identifier = await input("Identifier: ");
    const password = readlineSync.question("Password: ", {
      hideEchoBack: true,
      mask: "*",
    });
    if (!identifier || !password)
      throw new Error("Missing identifier and/or Password");
    await agent.login({
      identifier,
      password,
    });
  }

  const { data: profileData } = await agent.getProfile({ actor: agent.did });

  console.info(
    `Logged in as ${profileData.displayName || "@" + profileData.handle} ${
      profileData.displayName && `(@${profileData.handle})`
    }`
  );
  console.info(
    `Followers: ${profileData.followersCount} | Following: ${profileData.followsCount}`
  );
}

/**
 * Get user's follows and followers, returns a tuple.
 * @returns {Promise<[import("@atproto/api").AppBskyActorDefs.ProfileView[], import("@atproto/api").AppBskyActorDefs.ProfileView[]]>
 */
async function getFollowersAndFollowing() {
  const { data: followersData } = await agent.getFollowers({
    actor: agent.did,
  });
  const { data: followingData } = await agent.getFollows({ actor: agent.did });

  return [followersData.followers, followingData.follows];
}

await promptSessionStart();
const [followers, follows] = await getFollowersAndFollowing();

for await (const follow of follows) {
  const foundRelatedFollower = followers.find(
    (follower) => follower.did === follow.did
  ); // Find by DID

  if (foundRelatedFollower) continue;

  console.log("Unfollowing", follow.displayName ?? "@" + follow.handle);
  try {
    await agent.deleteFollow(follow.viewer.following);
  } catch (error) {
    console.error("[ERROR] Could not delete follow", follow.handle + ".", "Stack trace included below:\n" + inspect(error, false, 1, true))
  }

  await delay(2); // Artificial delay, as I don't want to do ratelimiting :)
}

// Assume we are done, hopefully, no errors should be thrown

console.log(
  "Seems like everything is done! Check your follows on",
  agent.serviceUrl.host,
  "to make sure the users listed were unfollowed!"
);
