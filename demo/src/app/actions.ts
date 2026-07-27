'use server';

export async function triggerWorker() {
  return { success: true, message: 'Demo Mode: Worker job simulated successfully.' };
}

export async function triggerCleanup() {
  return { success: true, message: 'Demo Mode: Cleanup simulated successfully.' };
}

export async function triggerLogCleanup() {
  return { success: true, message: 'Demo Mode: Log cleanup simulated.' };
}

export async function triggerStar(owner: string, repo: string) {
  return { success: true, message: `Demo Mode: Starred ${owner}/${repo}` };
}

export async function triggerUnstar(owner: string, repo: string) {
  return { success: true, message: `Demo Mode: Unstarred ${owner}/${repo}` };
}

export async function triggerFollow(username: string) {
  return { success: true, message: `Demo Mode: Followed ${username}` };
}

export async function triggerUnfollow(username: string) {
  return { success: true, message: `Demo Mode: Unfollowed ${username}` };
}

export async function triggerClearStale() {
  return { success: true, message: 'Demo Mode: Cleared stale entries.' };
}

export async function triggerDeleteProfile(owner: string) {
  return { success: true, message: `Demo Mode: Deleted profile ${owner}` };
}

export async function triggerSyncFollowing() {
  return { success: true, message: 'Demo Mode: Synced following list.' };
}

export async function getWorkerStatus() {
  return { status: 'idle', lastRun: new Date().toISOString() };
}
