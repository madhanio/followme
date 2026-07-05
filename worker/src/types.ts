export interface RepoMetadata {
  id: number;
  github_url: string;
  owner: string;
  name: string;
  stars: number;
  language: string;
  topics: string[];
  readme_snippet: string;
  description: string;
}

export interface GradedRepo extends RepoMetadata {
  grade: number;
  reason: string;
}
