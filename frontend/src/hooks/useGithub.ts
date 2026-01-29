import { useState, useEffect } from 'react';
import type { GitHubIssue } from '@/types';

export function useGitHub() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetches a specific GitHub issue
   */
  const getIssue = async (
    owner: string,
    repo: string,
    issueNumber: string
  ): Promise<GitHubIssue | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}`,
        {
          headers: {
            'Accept': 'application/vnd.github.v3+json'
          }
        }
      );

      if (!response.ok) {
        if (response.status === 404) {
          setError('Issue not found');
          return null;
        }
        throw new Error(`GitHub API error: ${response.status}`);
      }

      const issue = await response.json();
      return issue as GitHubIssue;
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to fetch issue';
      setError(errorMessage);
      console.error('GitHub API error:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Fetches all issues for a repository
   */
  const getIssues = async (
    owner: string,
    repo: string,
    state: 'open' | 'closed' | 'all' = 'open'
  ): Promise<GitHubIssue[]> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/issues?state=${state}&per_page=100`,
        {
          headers: {
            'Accept': 'application/vnd.github.v3+json'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status}`);
      }

      const issues = await response.json();
      // Filter out pull requests (GitHub API includes PRs in issues endpoint)
      return issues.filter((issue: any) => !issue.pull_request) as GitHubIssue[];
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to fetch issues';
      setError(errorMessage);
      console.error('GitHub API error:', err);
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Validates if a PR exists and is merged
   */
  const validatePR = async (
    owner: string,
    repo: string,
    prNumber: string
  ): Promise<{ valid: boolean; merged: boolean; author: string }> => {
    try {
      const response = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`,
        {
          headers: {
            'Accept': 'application/vnd.github.v3+json'
          }
        }
      );

      if (!response.ok) {
        return { valid: false, merged: false, author: '' };
      }

      const pr = await response.json();
      return {
        valid: true,
        merged: pr.merged || false,
        author: pr.user?.login || ''
      };
    } catch (error) {
      console.error('Error validating PR:', error);
      return { valid: false, merged: false, author: '' };
    }
  };

  /**
   * Parses GitHub URL to extract owner, repo, and issue number
   */
  const parseGitHubUrl = (url: string): {
    owner: string;
    repo: string;
    issueNumber: string;
  } | null => {
    const patterns = [
      /github\.com\/([^\/]+)\/([^\/]+)\/issues\/(\d+)/,
      /github\.com\/([^\/]+)\/([^\/]+)\/pull\/(\d+)/
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return {
          owner: match[1],
          repo: match[2],
          issueNumber: match[3]
        };
      }
    }

    return null;
  };

  return {
    getIssue,
    getIssues,
    validatePR,
    parseGitHubUrl,
    isLoading,
    error
  };
}

/**
 * Hook that automatically fetches an issue on mount
 */
export function useIssue(owner: string, repo: string, issueNumber: string) {
  const { getIssue, isLoading, error } = useGitHub();
  const [issue, setIssue] = useState<GitHubIssue | null>(null);

  useEffect(() => {
    if (owner && repo && issueNumber) {
      getIssue(owner, repo, issueNumber).then(setIssue);
    }
  }, [owner, repo, issueNumber]);

  return { issue, isLoading, error };
}