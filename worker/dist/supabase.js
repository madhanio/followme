"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.supabase = void 0;
exports.isRepoGraded = isRepoGraded;
exports.saveRepo = saveRepo;
exports.logAction = logAction;
const supabase_js_1 = require("@supabase/supabase-js");
const ws_1 = __importDefault(require("ws"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Missing Supabase URL or Anon Key. Database functions may fail.');
}
exports.supabase = (0, supabase_js_1.createClient)(supabaseUrl || '', supabaseAnonKey || '', {
    auth: {
        persistSession: false,
    },
    realtime: {
        transport: ws_1.default,
    },
});
async function isRepoGraded(repoId) {
    try {
        const { data, error } = await exports.supabase
            .from('repos')
            .select('id')
            .eq('id', repoId)
            .maybeSingle();
        if (error) {
            console.error(`Error checking if repo ${repoId} is graded:`, error.message);
            return false;
        }
        return data !== null;
    }
    catch (err) {
        console.error(`Failed to check if repo ${repoId} is graded:`, err.message || err);
        return false;
    }
}
async function saveRepo(repo, followed, starred) {
    try {
        const { error } = await exports.supabase.from('repos').upsert({
            id: repo.id,
            github_url: repo.github_url,
            owner: repo.owner,
            name: repo.name,
            stars: repo.stars,
            language: repo.language,
            topics: repo.topics,
            readme_snippet: repo.readme_snippet,
            grade: repo.grade,
            graded_at: new Date().toISOString(),
            followed,
            starred,
        });
        if (error) {
            console.error(`Error saving repo ${repo.owner}/${repo.name}:`, error.message);
            throw error;
        }
    }
    catch (err) {
        console.error(`Failed to save repo ${repo.owner}/${repo.name}:`, err.message || err);
        throw err;
    }
}
async function logAction(action, repoId, status, message) {
    try {
        const { error } = await exports.supabase.from('logs').insert({
            action,
            repo_id: repoId,
            status,
            message: message || null,
            timestamp: new Date().toISOString(),
        });
        if (error) {
            console.error(`Error inserting log [${action}]:`, error.message);
        }
    }
    catch (err) {
        console.error(`Failed to log action [${action}]:`, err.message || err);
    }
}
