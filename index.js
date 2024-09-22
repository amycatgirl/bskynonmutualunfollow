//@ts-check
import { AtpAgent, CredentialSession } from "@atproto/api";
import { input } from "./common/stdio.js";
import { inspect } from "node:util";
import { writeFile, open, stat } from "node:fs/promises";

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

  const { data: profileData } = await agent.getProfile({ actor: agent.did ?? "" });

  console.info(
    `Logged in as ${profileData.displayName || "@" + profileData.handle} ${profileData.displayName && `(@${profileData.handle})`
    }`
  );
  console.debug("DID: " + profileData.did);
  console.info(
    `Followers: ${profileData.followersCount} | Following: ${profileData.followsCount}`
  );
}

/**
 * Get user's follows, returns an array of ProfileViews
 * @returns {Promise<import("@atproto/api").AppBskyActorDefs.ProfileView[]>}
 */
async function getFollowing() {
  console.log("Indexing follows, please be patient...")
  /** @type {import("@atproto/api").AppBskyActorDefs.ProfileView[]} */
  const aggregateData = [] // Add this just in case we have a cursor, which we most definitely will have

  // First fetch
  const { data } = await agent.getFollows({
    actor: agent.did ?? "",
    limit: 100,
  });
  
  aggregateData.push(...data.follows)

  /**
   * @param {string} [cursor] - Optional cursor, used for pagination
   */
  async function fetchWithCursor(cursor) {
    const { data } = await agent.getFollows({
      actor: agent.did ?? "",
      limit: 2,
      cursor
    });
    aggregateData.push(...data.follows)

    if (data.cursor) {
      // recursion, my beloved
      await fetchWithCursor(data.cursor)

      // who needs ratelimits anyway? :clueless:
    }
  }

  if (data.cursor) {
    await fetchWithCursor(data.cursor)
  }

  return aggregateData
}

await promptSessionStart();
const data = await getFollowing();

console.debug(inspect(data, false, 100, true))

let unfollowedAccounts = 0;

for await (const follow of data) {
  if (follow.viewer?.followedBy) {
    console.debug("Mutual " + follow.displayName || "@" + follow.handle);
    continue;
  } // They are following us, do not unfollow them

  console.debug("NonMutual", follow.displayName || "@" + follow.handle);
  try {
    // @ts-expect-error FUCKING HELL AGENT IS ASSIGNED YOU DIPSHIT
    agent.deleteFollow(follow.viewer?.following);
    unfollowedAccounts++
  } catch (error) {
    console.error("[ERROR] Could not delete follow", follow.handle + ".", "Stack trace included below.")
    throw error // Bubble the exeption up
  }
}

// Assume we are done, hopefully, no errors should be thrown
console.log(`Deleted ${unfollowedAccounts} follows from your account.`)
console.log(
  "Please double check your follows on",
  //@ts-expect-error agent IS initialized, typescript is just clueless about it
  agent.serviceUrl.host,
  "to make sure the users listed were unfollowed!"
);
console.log("If any are missing, please report an issue on GitHub.")