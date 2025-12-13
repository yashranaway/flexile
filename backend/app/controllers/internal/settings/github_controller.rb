# frozen_string_literal: true

class Internal::Settings::GithubController < Internal::Settings::BaseController
  def show
    render json: {
      connected: Current.user.github_connected?,
      username: Current.user.github_username,
      uid: Current.user.github_uid,
    }
  end

  def connect
    oauth_service = Github::OauthService.new
    state = SecureRandom.hex(24)
    session[:github_oauth_state] = state

    redirect_uri = "#{request.base_url}/internal/settings/github/callback"
    authorization_url = oauth_service.authorization_url(redirect_uri: redirect_uri, state: state)

    render json: { authorization_url: authorization_url }
  end

  def callback
    if params[:state] != session[:github_oauth_state]
      render_popup_error("Invalid state parameter")
      return
    end

    session.delete(:github_oauth_state)

    oauth_service = Github::OauthService.new

    begin
      token_data = oauth_service.exchange_code_for_token(code: params[:code])
    rescue Github::OauthService::OauthError => e
      render_popup_error(e.message)
      return
    end

    access_token = token_data[:access_token]

    begin
      github_user = oauth_service.fetch_user(access_token: access_token)
    rescue Github::OauthService::ApiError => e
      render_popup_error(e.message)
      return
    end

    existing_user = User.where.not(id: Current.user.id).find_by(github_uid: github_user[:id].to_s)
    if existing_user
      render_popup_error("This GitHub account is already connected to another user")
      return
    end

    Current.user.connect_github!(
      uid: github_user[:id],
      access_token: access_token,
      username: github_user[:login]
    )

    render_popup_success(username: github_user[:login])
  end

  def destroy
    Current.user.disconnect_github!
    render json: { connected: false }
  end

  private
    def render_popup_success(username:)
      render html: popup_html(success: true, username: username), layout: false, content_type: "text/html"
    end

    def render_popup_error(message)
      render html: popup_html(success: false, error: message), layout: false, content_type: "text/html"
    end

    def popup_html(success:, username: nil, error: nil)
      data = { success: success, username: username, error: error }.compact.to_json
      <<~HTML.html_safe
      <!DOCTYPE html>
      <html>
        <head>
          <title>GitHub Connection</title>
        </head>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage(#{data}, window.location.origin);
            }
            window.close();
          </script>
          <p>#{success ? 'GitHub connected successfully!' : "Error: #{error}"}</p>
          <p>This window will close automatically...</p>
        </body>
      </html>
      HTML
    end
end
