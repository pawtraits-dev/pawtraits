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
      let errorMessage = 'Failed to fetch data';

      if (error instanceof Error) {
        if (platform.toLowerCase() === 'instagram') {
          errorMessage = 'Instagram limits automated data access. Account exists but follower data not available - please enter manually.';
        } else if (platform.toLowerCase() === 'twitter') {
          errorMessage = 'Twitter/X restricts automated access. Account validation may not work - please enter data manually.';
        } else {
          errorMessage = error.message;
        }
      }

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
        error: errorMessage
      };
    }
  }

  private static async fetchInstagramData(username: string): Promise<SocialMediaData> {
    const url = `https://www.instagram.com/${username}/`;

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': this.USER_AGENT,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Instagram account not found');
        }
        throw new Error(`Failed to fetch Instagram data: ${response.status}`);
      }

      const html = await response.text();

      // Instagram has implemented strong anti-bot measures
      // The follower data is now loaded dynamically via AJAX after page load

      let follower_count = null;
      let following_count = null;
      let post_count = null;
      let verified = false;
      let avatar_url = null;
      let bio = null;

      // Try multiple patterns for follower count
      const followerPatterns = [
        /"edge_followed_by":\s*{\s*"count":\s*(\d+)/,
        /"followers":\s*(\d+)/,
        /followers":\s*(\d+)/,
        /,"c":\s*(\d+),"t":"followers"/,
      ];

      for (const pattern of followerPatterns) {
        const match = html.match(pattern);
        if (match) {
          follower_count = parseInt(match[1], 10);
          console.log(`Found follower count with pattern ${pattern.source}:`, follower_count);
          break;
        }
      }

      // Try multiple patterns for following count
      const followingPatterns = [
        /"edge_follow":\s*{\s*"count":\s*(\d+)/,
        /"following":\s*(\d+)/,
        /following":\s*(\d+)/,
        /,"c":\s*(\d+),"t":"following"/,
      ];

      for (const pattern of followingPatterns) {
        const match = html.match(pattern);
        if (match) {
          following_count = parseInt(match[1], 10);
          break;
        }
      }

      // Try multiple patterns for post count
      const postPatterns = [
        /"edge_owner_to_timeline_media":\s*{\s*"count":\s*(\d+)/,
        /"posts":\s*(\d+)/,
        /posts":\s*(\d+)/,
        /,"c":\s*(\d+),"t":"posts"/,
      ];

      for (const pattern of postPatterns) {
        const match = html.match(pattern);
        if (match) {
          post_count = parseInt(match[1], 10);
          break;
        }
      }

      // Check for verification
      const verifiedPatterns = [
        /"is_verified":\s*true/,
        /"verified":\s*true/,
        /verified":\s*true/,
      ];

      for (const pattern of verifiedPatterns) {
        if (html.match(pattern)) {
          verified = true;
          break;
        }
      }

      // Try to extract profile picture
      const avatarPatterns = [
        /"profile_pic_url_hd":\s*"([^"]+)"/,
        /"profile_pic_url":\s*"([^"]+)"/,
        /profile_pic_url":\s*"([^"]+)"/,
      ];

      for (const pattern of avatarPatterns) {
        const match = html.match(pattern);
        if (match) {
          avatar_url = match[1].replace(/\\u0026/g, '&').replace(/\\\//g, '/');
          break;
        }
      }

      // Try to extract bio
      const bioPatterns = [
        /"biography":\s*"([^"]+)"/,
        /biography":\s*"([^"]+)"/,
      ];

      for (const pattern of bioPatterns) {
        const match = html.match(pattern);
        if (match) {
          bio = match[1].replace(/\\n/g, '\n').replace(/\\u[\da-f]{4}/gi, '').replace(/\\\//g, '/');
          break;
        }
      }

      // If we didn't get follower count, try to extract from meta tags or structured data
      if (!follower_count) {
        const metaPatterns = [
          /<meta[^>]*content="[^"]*(\d{1,3}(?:,\d{3})*(?:\.\d+)?[KMB]?)\s*followers"/i,
          /<script[^>]*type="application\/ld\+json"[^>]*>([^<]+)<\/script>/
        ];

        for (const pattern of metaPatterns) {
          const match = html.match(pattern);
          if (match) {
            if (pattern.source.includes('ld+json')) {
              try {
                const jsonData = JSON.parse(match[1]);
                // Instagram structured data might contain follower information
                console.log('Instagram structured data:', jsonData);
              } catch (e) {
                // Ignore JSON parse errors
              }
            } else {
              // Parse follower count from meta description
              const followerStr = match[1];
              if (followerStr.includes('K')) {
                follower_count = Math.round(parseFloat(followerStr.replace('K', '').replace(',', '')) * 1000);
              } else if (followerStr.includes('M')) {
                follower_count = Math.round(parseFloat(followerStr.replace('M', '').replace(',', '')) * 1000000);
              } else if (followerStr.includes('B')) {
                follower_count = Math.round(parseFloat(followerStr.replace('B', '').replace(',', '')) * 1000000000);
              } else {
                follower_count = parseInt(followerStr.replace(/,/g, ''), 10);
              }
              break;
            }
          }
        }
      }

      console.log('Instagram extraction results:', {
        follower_count,
        following_count,
        post_count,
        verified,
        has_avatar: !!avatar_url,
        has_bio: !!bio
      });

      return {
        platform: 'instagram',
        username,
        follower_count,
        following_count,
        post_count,
        engagement_rate: null, // Would need additional API calls to calculate
        verified,
        profile_url: url,
        avatar_url,
        bio,
        error: follower_count === null ? 'Instagram data extraction limited due to anti-bot measures. Please enter follower count manually.' : undefined
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