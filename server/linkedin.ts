/**
 * LinkedIn Profile Service
 * Fetches real-time profile data from LinkedIn using the Manus Data API
 */

import { callDataApi } from "./_core/dataApi";

export interface LinkedInProfile {
  firstName?: string;
  lastName?: string;
  headline?: string;
  summary?: string;
  location?: string;
  profilePicture?: string;
  positions?: Array<{
    title: string;
    companyName: string;
    startYear?: number;
    endYear?: number;
    description?: string;
  }>;
  educations?: Array<{
    schoolName: string;
    degree?: string;
    fieldOfStudy?: string;
    startYear?: number;
    endYear?: number;
  }>;
  skills?: Array<{
    name: string;
    endorsementsCount?: number;
  }>;
  isOpenToWork?: boolean;
  isPremium?: boolean;
  followerCount?: number;
  connectionCount?: number;
}

/**
 * Extract LinkedIn username from URL
 */
export function extractLinkedInUsername(url: string): string | null {
  if (!url) return null;
  
  // Handle various LinkedIn URL formats
  const patterns = [
    /linkedin\.com\/in\/([^\/\?]+)/i,
    /linkedin\.com\/pub\/([^\/\?]+)/i,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1].replace(/\/$/, '');
    }
  }
  
  // If it's already just a username (no URL)
  if (!url.includes('/') && !url.includes('.')) {
    return url;
  }
  
  return null;
}

/**
 * Fetch LinkedIn profile data by username
 */
export async function getLinkedInProfile(username: string): Promise<LinkedInProfile | null> {
  try {
    const result = await callDataApi("LinkedIn/get_user_profile_by_username", {
      query: { username }
    }) as any;
    
    if (!result || result.error) {
      console.error('LinkedIn API error:', result?.error || 'Unknown error');
      return null;
    }
    
    // Parse the response - API returns data directly or wrapped in success/data
    const data = result.data || result;
    
    if (!data || (!data.firstName && !data.id)) {
      return null;
    }
    
    // Map the API response to our interface
    const profile: LinkedInProfile = {
      firstName: data.firstName,
      lastName: data.lastName,
      headline: data.headline,
      summary: data.summary,
      location: data.geo?.full || data.location,
      profilePicture: data.profilePicture,
      isOpenToWork: data.isOpenToWork,
      isPremium: data.isPremium,
      followerCount: data.followerCount,
      connectionCount: data.connectionCount,
    };
    
    // Map positions/experience
    if (data.position && Array.isArray(data.position)) {
      profile.positions = data.position.map((p: any) => ({
        title: p.title,
        companyName: p.companyName,
        startYear: p.start?.year,
        endYear: p.end?.year || null,
        description: p.description
      }));
    }
    
    // Map education
    if (data.educations && Array.isArray(data.educations)) {
      profile.educations = data.educations.map((e: any) => ({
        schoolName: e.schoolName,
        degree: e.degree,
        fieldOfStudy: e.fieldOfStudy,
        startYear: e.start?.year,
        endYear: e.end?.year
      }));
    }
    
    // Map skills
    if (data.skills && Array.isArray(data.skills)) {
      profile.skills = data.skills.map((s: any) => ({
        name: s.name,
        endorsementsCount: s.endorsementsCount
      })).sort((a: any, b: any) => (b.endorsementsCount || 0) - (a.endorsementsCount || 0));
    }
    
    return profile;
  } catch (error) {
    console.error('Error fetching LinkedIn profile:', error);
    return null;
  }
}

/**
 * Format LinkedIn profile for AI context
 */
export function formatLinkedInForAI(profile: LinkedInProfile): string {
  const parts: string[] = [];
  
  parts.push(`## LinkedIn Profile`);
  
  if (profile.headline) {
    parts.push(`**Headline:** ${profile.headline}`);
  }
  
  if (profile.summary) {
    parts.push(`**About:** ${profile.summary.substring(0, 500)}${profile.summary.length > 500 ? '...' : ''}`);
  }
  
  if (profile.location) {
    parts.push(`**Location:** ${profile.location}`);
  }
  
  // Current position
  if (profile.positions && profile.positions.length > 0) {
    const current = profile.positions[0];
    parts.push(`\n### Current Role`);
    parts.push(`**${current.title}** at **${current.companyName}**`);
    if (current.startYear) {
      parts.push(`Since ${current.startYear}`);
    }
    if (current.description) {
      parts.push(`${current.description.substring(0, 300)}${current.description.length > 300 ? '...' : ''}`);
    }
  }
  
  // Previous experience (top 3)
  if (profile.positions && profile.positions.length > 1) {
    parts.push(`\n### Previous Experience`);
    profile.positions.slice(1, 4).forEach(p => {
      const duration = p.startYear ? `(${p.startYear}${p.endYear ? ` - ${p.endYear}` : ''})` : '';
      parts.push(`- **${p.title}** at ${p.companyName} ${duration}`);
    });
  }
  
  // Education
  if (profile.educations && profile.educations.length > 0) {
    parts.push(`\n### Education`);
    profile.educations.slice(0, 2).forEach(e => {
      const degree = e.degree ? `${e.degree}` : '';
      const field = e.fieldOfStudy ? ` in ${e.fieldOfStudy}` : '';
      parts.push(`- **${e.schoolName}** ${degree}${field}`);
    });
  }
  
  // Top skills
  if (profile.skills && profile.skills.length > 0) {
    parts.push(`\n### Top Skills`);
    const topSkills = profile.skills.slice(0, 10).map(s => s.name).join(', ');
    parts.push(topSkills);
  }
  
  // Status indicators
  const indicators: string[] = [];
  if (profile.isOpenToWork) indicators.push('Open to Work');
  if (profile.isPremium) indicators.push('LinkedIn Premium');
  if (profile.followerCount && profile.followerCount > 1000) indicators.push(`${profile.followerCount.toLocaleString()} followers`);
  
  if (indicators.length > 0) {
    parts.push(`\n**Status:** ${indicators.join(' | ')}`);
  }
  
  return parts.join('\n');
}

/**
 * Fetch and format LinkedIn profile for a contact
 */
export async function getLinkedInContextForContact(linkedinUrl: string): Promise<string | null> {
  const username = extractLinkedInUsername(linkedinUrl);
  if (!username) {
    return null;
  }
  
  const profile = await getLinkedInProfile(username);
  if (!profile) {
    return null;
  }
  
  return formatLinkedInForAI(profile);
}
