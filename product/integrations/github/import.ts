import { z } from 'zod';
import fetch from 'node-fetch';

// GitHub API Integration
export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  clone_url: string;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  created_at: string;
  updated_at: string;
}

export async function searchGitHubRepos(
  accessToken: string | undefined,
  query: string,
  sort: 'stars' | 'forks' | 'updated' = 'stars'
): Promise<GitHubRepo[]> {
  const url = new URL('https://api.github.com/search/repositories');
  url.searchParams.set('q', query);
  url.searchParams.set('sort', sort);
  url.searchParams.set('per_page', '30');
  
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
  };
  if (accessToken) {
    headers['Authorization'] = `token ${accessToken}`;
  }
  
  const response = await fetch(url.toString(), { headers });
  const data = await response.json() as any;
  
  if (data.error) throw new Error(`GitHub API error: ${data.error}`);
  return data.items || [];
}

export async function getGitHubRepoDetails(
  accessToken: string | undefined,
  owner: string,
  repo: string
): Promise<GitHubRepo> {
  const url = `https://api.github.com/repos/${owner}/${repo}`;
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
  };
  if (accessToken) {
    headers['Authorization'] = `token ${accessToken}`;
  }
  
  const response = await fetch(url, { headers });
  const data = await response.json() as any;
  if (data.error) throw new Error(`GitHub API error: ${data.error}`);
  return data;
}

export function mapToAICRMRepo(githubRepo: GitHubRepo) {
  return {
    externalId: `github:${githubRepo.full_name}`,
    name: githubRepo.name,
    fullName: githubRepo.full_name,
    description: githubRepo.description,
    url: githubRepo.html_url,
    cloneUrl: githubRepo.clone_url,
    stars: githubRepo.stargazers_count,
    forks: githubRepo.forks_count,
    openIssues: githubRepo.open_issues_count,
    createdAt: githubRepo.created_at,
    updatedAt: githubRepo.updated_at,
    metadata: {
      source: 'github',
      originalId: githubRepo.id,
      owner: githubRepo.full_name.split('/')[0],
    },
    lastSyncedAt: new Date(),
  };
}
