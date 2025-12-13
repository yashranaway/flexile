# frozen_string_literal: true

module Github
  class OauthService
    GITHUB_OAUTH_URL = "https://github.com/login/oauth/authorize"
    GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token"
    GITHUB_API_URL = "https://api.github.com"

    class OauthError < StandardError; end
    class ApiError < StandardError; end

    def authorization_url(redirect_uri:, state:)
      params = {
        client_id: github_client_id,
        redirect_uri: redirect_uri,
        scope: "read:user user:email",
        state: state,
      }
      "#{GITHUB_OAUTH_URL}?#{params.to_query}"
    end

    def exchange_code_for_token(code:)
      response = HTTP.headers(accept: "application/json").post(GITHUB_TOKEN_URL, form: {
        client_id: github_client_id,
        client_secret: github_client_secret,
        code: code,
      })

      unless response.status.success?
        raise OauthError, "Failed to exchange code for token: #{response.status}"
      end

      data = response.parse
      if data["error"]
        raise OauthError, data["error_description"] || data["error"]
      end

      {
        access_token: data["access_token"],
        token_type: data["token_type"],
        scope: data["scope"],
      }
    end

    def fetch_user(access_token:)
      response = github_api_request(access_token: access_token, path: "/user")
      unless response.status.success?
        raise ApiError, "Failed to fetch GitHub user: #{response.status}"
      end

      data = response.parse
      {
        id: data["id"],
        login: data["login"],
        email: data["email"],
        name: data["name"],
        avatar_url: data["avatar_url"],
      }
    end

    def fetch_user_emails(access_token:)
      response = github_api_request(access_token: access_token, path: "/user/emails")
      unless response.status.success?
        raise ApiError, "Failed to fetch GitHub emails: #{response.status}"
      end

      response.parse
    end

    def fetch_pull_request(access_token:, owner:, repo:, pr_number:)
      response = github_api_request(
        access_token: access_token,
        path: "/repos/#{owner}/#{repo}/pulls/#{pr_number}"
      )

      return nil unless response.status.success?

      data = response.parse
      {
        number: data["number"],
        title: data["title"],
        state: data["state"],
        merged: data["merged"],
        merged_at: data["merged_at"],
        html_url: data["html_url"],
        user: {
          id: data.dig("user", "id"),
          login: data.dig("user", "login"),
          avatar_url: data.dig("user", "avatar_url"),
        },
        head: {
          repo: {
            full_name: data.dig("head", "repo", "full_name"),
            owner: {
              login: data.dig("head", "repo", "owner", "login"),
            },
          },
          ref: data.dig("head", "ref"),
        },
        labels: data["labels"]&.map { |l| { name: l["name"] } } || [],
      }
    end

    def fetch_issue(access_token:, owner:, repo:, issue_number:)
      response = github_api_request(
        access_token: access_token,
        path: "/repos/#{owner}/#{repo}/issues/#{issue_number}"
      )

      return nil unless response.status.success?

      data = response.parse
      {
        number: data["number"],
        title: data["title"],
        state: data["state"],
        html_url: data["html_url"],
        labels: data["labels"]&.map { |l| { name: l["name"] } } || [],
      }
    end

    private
      def github_client_id
        ENV.fetch("GITHUB_CLIENT_ID")
      end

      def github_client_secret
        ENV.fetch("GITHUB_CLIENT_SECRET")
      end

      def github_api_request(access_token:, path:, method: :get, body: nil)
        headers = {
          "Authorization" => "Bearer #{access_token}",
          "Accept" => "application/vnd.github+json",
          "X-GitHub-Api-Version" => "2022-11-28",
        }

        request = HTTP.headers(headers)
        if method == :get
          request.get("#{GITHUB_API_URL}#{path}")
        else
          request.post("#{GITHUB_API_URL}#{path}", json: body)
        end
      end
  end
end
