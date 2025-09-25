export interface SocialMediaData {
  platform: string;
  username: string;
  follower_count: number | null;
  following_count: number | null;
  post_count: number | null;
  engagement_rate: number | null;
  verified: boolean;
  profile_url: string;
  avatar_url: string | null;
  bio: string | null;
  error?: string;
}

export class SocialMediaFetcher {
  private static readonly USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';

  /**
   * Validates if a username exists on a platform and fetches basic public data
   */
  static async fetchSocialData(platform: string, username: string): Promise<SocialMediaData> {
    const cleanUsername = username.replace(/^@/, '').trim();

    try {
      switch (platform.toLowerCase()) {
        case 'instagram':
          return await this.fetchInstagramData(cleanUsername);
        case 'twitter':
          return await this.fetchTwitterData(cleanUsername);
        case 'tiktok':
          return await this.fetchTikTokData(cleanUsername);
        case 'youtube':
          return await this.fetchYouTubeData(cleanUsername);
        case 'facebook':
          return await this.fetchFacebookData(cleanUsername);
        default:
          throw new Error(`Platform ${platform} not supported`);
      }
    } catch (error) {
      console.error(`Error fetching ${platform} data for ${username}:`, error);
      return {
        platform,
        username: cleanUsername,
        follower_count: null,
        following_count: null,
        post_count: null,
        engagement_rate: null,
        verified: false,
        profile_url: this.getProfileUrl(platform, cleanUsername),
        avatar_url: null,
        bio: null,
        error: error instanceof Error ? error.message : 'Failed to fetch data'
      };
    }
  }

  private static async fetchInstagramData(username: string): Promise<SocialMediaData> {
    const url = `https://www.instagram.com/${username}/`;

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': this.USER_AGENT,
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Instagram account not found');
        }
        throw new Error(`Failed to fetch Instagram data: ${response.status}`);
      }

      const html = await response.text();

      // Extract JSON data from Instagram's page
      const jsonMatch = html.match(/<script type="application\/ld\+json"[^>]*>([^<]+)<\/script>/);
      let data: any = null;

      if (jsonMatch) {
        try {
          data = JSON.parse(jsonMatch[1]);
        } catch (e) {
          // Fallback to regex extraction if JSON parsing fails
        }
      }

      // Fallback: Extract data using regex patterns
      const followerMatch = html.match(/"edge_followed_by":{"count":(\d+)}/);
      const followingMatch = html.match(/"edge_follow":{"count":(\d+)}/);
      const postMatch = html.match(/"edge_owner_to_timeline_media":{"count":(\d+)}/);
      const verifiedMatch = html.match(/"is_verified":true/);
      const avatarMatch = html.match(/"profile_pic_url_hd":"([^"]+)"/);
      const bioMatch = html.match(/"biography":"([^"]+)"/);

      return {
        platform: 'instagram',
        username,
        follower_count: followerMatch ? parseInt(followerMatch[1], 10) : null,
        following_count: followingMatch ? parseInt(followingMatch[1], 10) : null,
        post_count: postMatch ? parseInt(postMatch[1], 10) : null,
        engagement_rate: null, // Would need additional API calls to calculate
        verified: !!verifiedMatch,
        profile_url: url,
        avatar_url: avatarMatch ? avatarMatch[1].replace(/\\u0026/g, '&') : null,
        bio: bioMatch ? bioMatch[1].replace(/\\n/g, '\n').replace(/\\u[\da-f]{4}/gi, '') : null,
      };
    } catch (error) {
      throw error;
    }
  }

  private static async fetchTwitterData(username: string): Promise<SocialMediaData> {
    // Twitter/X has heavily restricted public access, so we'll do basic validation
    const url = `https://twitter.com/${username}`;

    try {
      const response = await fetch(url, {
        method: 'HEAD', // Just check if profile exists
        headers: {
          'User-Agent': this.USER_AGENT,
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Twitter/X account not found');
        }
        throw new Error(`Failed to access Twitter/X profile: ${response.status}`);
      }

      // For Twitter, we can only validate existence due to API restrictions
      return {
        platform: 'twitter',
        username,
        follower_count: null,
        following_count: null,
        post_count: null,
        engagement_rate: null,
        verified: false,
        profile_url: url,
        avatar_url: null,
        bio: null,
      };
    } catch (error) {
      throw error;
    }
  }

  private static async fetchTikTokData(username: string): Promise<SocialMediaData> {
    const url = `https://www.tiktok.com/@${username}`;

    try {
      const response = await fetch(url, {
        method: 'HEAD', // Just check if profile exists
        headers: {
          'User-Agent': this.USER_AGENT,
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('TikTok account not found');
        }
        throw new Error(`Failed to access TikTok profile: ${response.status}`);
      }

      // TikTok data extraction would require more complex scraping
      return {
        platform: 'tiktok',
        username,
        follower_count: null,
        following_count: null,
        post_count: null,
        engagement_rate: null,
        verified: false,
        profile_url: url,
        avatar_url: null,
        bio: null,
      };
    } catch (error) {
      throw error;
    }
  }

  private static async fetchYouTubeData(username: string): Promise<SocialMediaData> {
    // YouTube requires API key for reliable data, but we can validate channel existence
    let url: string;

    // Handle different YouTube URL formats
    if (username.startsWith('UC') && username.length === 24) {
      url = `https://www.youtube.com/channel/${username}`;
    } else if (username.startsWith('@')) {
      url = `https://www.youtube.com/${username}`;
    } else {
      url = `https://www.youtube.com/@${username}`;
    }

    try {
      const response = await fetch(url, {
        method: 'HEAD',
        headers: {
          'User-Agent': this.USER_AGENT,
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('YouTube channel not found');
        }
        throw new Error(`Failed to access YouTube channel: ${response.status}`);
      }

      return {
        platform: 'youtube',
        username,
        follower_count: null, // Would need YouTube API for subscriber count
        following_count: null,
        post_count: null,
        engagement_rate: null,
        verified: false,
        profile_url: url,
        avatar_url: null,
        bio: null,
      };
    } catch (error) {
      throw error;
    }
  }

  private static async fetchFacebookData(username: string): Promise<SocialMediaData> {
    const url = `https://www.facebook.com/${username}`;

    try {
      const response = await fetch(url, {
        method: 'HEAD',
        headers: {
          'User-Agent': this.USER_AGENT,
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Facebook page not found');
        }
        throw new Error(`Failed to access Facebook page: ${response.status}`);
      }

      return {
        platform: 'facebook',
        username,
        follower_count: null,
        following_count: null,
        post_count: null,
        engagement_rate: null,
        verified: false,
        profile_url: url,
        avatar_url: null,
        bio: null,
      };
    } catch (error) {
      throw error;
    }
  }

  private static getProfileUrl(platform: string, username: string): string {
    switch (platform.toLowerCase()) {
      case 'instagram':
        return `https://www.instagram.com/${username}/`;
      case 'twitter':
        return `https://twitter.com/${username}`;
      case 'tiktok':
        return `https://www.tiktok.com/@${username}`;
      case 'youtube':
        return username.startsWith('UC') ? `https://www.youtube.com/channel/${username}` : `https://www.youtube.com/@${username}`;
      case 'facebook':
        return `https://www.facebook.com/${username}`;
      default:
        return '';
    }
  }

  /**
   * Validates username format for different platforms
   */
  static validateUsername(platform: string, username: string): { valid: boolean; error?: string } {
    const cleanUsername = username.replace(/^@/, '').trim();

    if (!cleanUsername) {
      return { valid: false, error: 'Username cannot be empty' };
    }

    switch (platform.toLowerCase()) {
      case 'instagram':
        if (!/^[a-zA-Z0-9_.]{1,30}$/.test(cleanUsername)) {
          return { valid: false, error: 'Instagram username must be 1-30 characters, letters, numbers, periods, and underscores only' };
        }
        break;

      case 'twitter':
        if (!/^[a-zA-Z0-9_]{1,15}$/.test(cleanUsername)) {
          return { valid: false, error: 'Twitter username must be 1-15 characters, letters, numbers, and underscores only' };
        }
        break;

      case 'tiktok':
        if (!/^[a-zA-Z0-9_.]{1,24}$/.test(cleanUsername)) {
          return { valid: false, error: 'TikTok username must be 1-24 characters, letters, numbers, periods, and underscores only' };
        }
        break;

      case 'youtube':
        // YouTube allows @ handles or channel IDs
        if (cleanUsername.startsWith('@')) {
          if (!/^@[a-zA-Z0-9._-]{1,30}$/.test(cleanUsername)) {
            return { valid: false, error: 'YouTube handle must start with @ and be 1-30 characters' };
          }
        } else if (cleanUsername.startsWith('UC') && cleanUsername.length === 24) {
          // Channel ID format
          if (!/^UC[a-zA-Z0-9_-]{22}$/.test(cleanUsername)) {
            return { valid: false, error: 'Invalid YouTube channel ID format' };
          }
        } else {
          if (!/^[a-zA-Z0-9._-]{1,30}$/.test(cleanUsername)) {
            return { valid: false, error: 'YouTube username must be 1-30 characters, letters, numbers, periods, underscores, and hyphens only' };
          }
        }
        break;

      case 'facebook':
        if (!/^[a-zA-Z0-9.]{1,50}$/.test(cleanUsername)) {
          return { valid: false, error: 'Facebook username must be 1-50 characters, letters, numbers, and periods only' };
        }
        break;

      default:
        return { valid: false, error: `Platform ${platform} not supported` };
    }

    return { valid: true };
  }
}