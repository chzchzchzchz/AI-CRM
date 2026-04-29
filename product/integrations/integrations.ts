import { z } from 'zod';
import fetch from 'node-fetch';

// LinkedIn API Integration - ACTUAL CODE
export interface LinkedInCompany {
  id: string;
  name: string;
  localizedName: string;
  description?: string;
  website?: string;
  industry?: string;
  staffCount?: number;
  followerCount?: number;
  foundedOn?: string;
  headquarters?: string;
}

export async function searchLinkedInCompanies(
  accessToken: string,
  keywords: string
): Promise<LinkedInCompany[]> {
  const url = new URL('https://api.linkedin.com/v2/organizations');
  url.searchParams.set('q', 'vanityName');
  url.searchParams.set('vanityName', keywords);
  
  const response = await fetch(url.toString(), {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'X-RestLi-Protocol-Version': '2.0.0',
    },
  });
  
  const data = await response.json();
  return data.elements || [];
}

export async function getLinkedInCompanyDetails(
  accessToken: string,
  orgId: string
): Promise<LinkedInCompany> {
  const response = await fetch(
    `https://api.linkedin.com/v2/organizations/${orgId}`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    }
  );
  
  return await response.json();
}

export function mapToAICRMCompany(linkedInCompany: LinkedInCompany) {
  return {
    externalId: `linkedin:${linkedInCompany.id}`,
    name: linkedInCompany.localizedName || linkedInCompany.name,
    domain: linkedInCompany.website 
      ? new URL(linkedInCompany.website).hostname : undefined,
    industry: linkedInCompany.industry,
    employeeCount: linkedInCompany.staffCount,
    location: linkedInCompany.headquarters,
    metadata: {
      source: 'linkedin',
      originalId: linkedInCompany.id,
      followers: linkedInCompany.followerCount,
      founded: linkedInCompany.foundedOn,
      description: linkedInCompany.description,
    },
    lastSyncedAt: new Date(),
  };
}

// GitHub API Integration - ACTUAL CODE
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
  owner: { login: string };
}

export async function searchGitHubRepos(
  accessToken: string | undefined,
  query: string
): Promise<GitHubRepo[]> {
  const url = new URL('https://api.github.com/search/repositories');
  url.searchParams.set('q', query);
  url.searchParams.set('sort', 'stars');
  url.searchParams.set('per_page', '30');
  
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
  };
  if (accessToken) {
    headers['Authorization'] = `token ${accessToken}`;
  }
  
  const response = await fetch(url.toString(), { headers });
  const data = await response.json();
  
  if (data.error) throw new Error(`GitHub API error: ${data.error}`);
  return data.items || [];
}

export function mapToAICRMAcount(githubRepo: GitHubRepo) {
  return {
    externalId: `github:${githubRepo.full_name}`,
    name: githubRepo.name,
    domain: githubRepo.owner?.login 
      ? `${githubRepo.owner.login}.github.io` : undefined,
    metadata: {
      source: 'github',
      originalId: githubRepo.id,
      owner: githubRepo.owner.login,
      description: githubRepo.description,
      stars: githubRepo.stargazers_count,
      forks: githubRepo.forks_count,
      openIssues: githubRepo.open_issues_count,
      createdAt: githubRepo.created_at,
      updatedAt: githubRepo.updated_at,
    },
    lastSyncedAt: new Date(),
  };
}
