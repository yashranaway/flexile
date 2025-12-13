# frozen_string_literal: true

class Internal::GithubOauthController < Internal::BaseController
  include UserDataSerialization, JwtAuthenticatable, ApiTokenAuthenticatable

  skip_before_action :verify_authenticity_token

  def create
    email = params[:email].to_s.strip.downcase
    github_uid = params[:github_uid].to_s
    github_username = params[:github_username].to_s
    github_access_token = params[:github_access_token].to_s

    if email.blank?
      render json: { error: "Email is required" }, status: :bad_request
      return
    end

    user = User.find_by(email: email) || User.find_by(github_uid: github_uid)

    if user
      user.connect_github!(uid: github_uid, access_token: github_access_token, username: github_username)
      user.update!(current_sign_in_at: Time.current)
      return success_response_with_jwt(user)
    end

    result = SignUpUser.new(
      user_attributes: {
        email: email,
        confirmed_at: Time.current,
        github_uid: github_uid,
        github_access_token: github_access_token,
        github_username: github_username,
      },
      ip_address: request.remote_ip
    ).perform

    if result[:success]
      success_response_with_jwt(result[:user], :created)
    else
      render json: { error: result[:error_message] }, status: :unprocessable_entity
    end
  end
end
