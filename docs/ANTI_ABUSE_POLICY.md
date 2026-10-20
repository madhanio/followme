# GitHub Anti-Abuse & Responsible Automation Policy

FollowMe is designed as an intelligent repository discovery and developer peer networking tool. It is **not** a growth hacking, follow-churn, or automated engagement bot.

To protect your GitHub account reputation, stay strictly compliant with the [GitHub Terms of Service](https://docs.github.com/en/site-policy/github-terms/github-terms-of-service) and [Acceptable Use Policies](https://docs.github.com/en/site-policy/acceptable-use-policies/github-acceptable-use-policies), FollowMe incorporates built-in conservative limits, pacing mechanisms, and protective guardrails.

---

## 1. GitHub API Rate Limits & Quota Monitoring

FollowMe actively monitors GitHub REST API rate limits prior to triggering mutations (starring, following, fetching candidate profiles).

| GitHub API Resource | Unauthenticated | Personal Access Token (PAT) | FollowMe Conservative Threshold |
| :--- | :--- | :--- | :--- |
| **Core REST API** | 60 requests / hour | 5,000 requests / hour | **Halts when $< 20\%$ quota remaining** |
| **Search API** | 10 requests / min | 30 requests / min | **Halts when $< 5$ requests remaining** |
| **GraphQL API** | — | 5,000 points / hour | Monitored dynamically |

### Safety Guardrail:
* If the remaining GitHub Core or Search API rate quota falls below 20%, the background worker terminates the execution cycle early and logs a `WARN / HALT` entry to the incident log.

---

## 2. Conservative Daily Rate Limits & Caps

Automated following and unfollowing at high frequency is recognized by GitHub detection systems as aggressive automation and can lead to account flags or temporary API suspensions. FollowMe enforces strict operational ceilings:

* **Daily Follow Maximum:** Hard-capped at **15–20 follows per 24 hours** (default recommended: 10–15).
* **Daily Repository Stars:** Capped at **15–25 stars per day**.
* **Pre-Grading Filters:** FollowMe does not blindly follow accounts found in repository searches:
  * Accounts with fewer than 3 followers are skipped (avoids spam/burner accounts).
  * High-profile creators with $> 500$ followers are **starred instead of followed** (prevents unilateral one-way following loops).
  * Repositories with missing READMEs, forks, or trivial templates are rejected before calling LLM APIs.

---

## 3. Human-like Jitter & Random Sleep Intervals

GitHub rate-limiting heuristics flag uniform robotic request intervals (e.g., executing exactly every 10.0 seconds).

FollowMe implements randomized pacing (jitter) between API operations:
* **Inter-request sleep:** A randomized delay of **12 to 28 seconds** between each candidate evaluation and follow action.
* **Worker Execution Schedule:** Defaults to periodic interval triggers (e.g., once or twice daily) rather than continuous polling.
* **Batch Bounds:** Each run evaluates a capped batch of candidates (typically 10–20 repositories per cycle) and then cleanly shuts down until the next scheduled interval.

---

## 4. Grace Periods & Unfollow Safety

FollowMe respects fellow builders and prevents aggressive follow/unfollow churn:

* **Configurable Grace Period:** Default **7-day grace window** before a non-reciprocal follow is evaluated for cleanup.
* **Manual Follow Whitelist:** Any accounts you followed manually through github.com, or accounts flagged as `whitelisted` in the dashboard, are excluded from automated unfollow routines.
* **Mutual Protection:** Any account that follows you back (`follow_back = true`) is permanently protected from automated unfollow cycles.

---

## 5. Compliance Checklist for Self-Hosters

When hosting your own FollowMe instance:
1. **Never share or expose your GitHub Personal Access Token (`GITHUB_TOKEN` / `GITHUB_PAT`).**
2. **Do not modify the safety bounds to exceed 30 follows/day.**
3. **Use fine-grained Personal Access Tokens** with only the minimal required scopes (`public_repo`, `user:follow`).
4. **Regularly review the dashboard activity feed and incident logs** to monitor health and rate limit usage.
