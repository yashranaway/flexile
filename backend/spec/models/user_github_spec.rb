# frozen_string_literal: true

RSpec.describe User do
  describe "GitHub connection" do
    let(:user) { create(:user) }

    describe "#github_connected?" do
      it "returns false when no GitHub connection" do
        expect(user.github_connected?).to be false
      end

      it "returns true when GitHub is connected" do
        user.connect_github!(uid: "12345", access_token: "test-token", username: "testuser")
        expect(user.github_connected?).to be true
      end

      it "returns false when only uid is present" do
        user.update!(github_uid: "12345")
        expect(user.github_connected?).to be false
      end
    end

    describe "#connect_github!" do
      it "sets all GitHub fields" do
        user.connect_github!(uid: "12345", access_token: "secret-token", username: "myuser")

        expect(user.github_uid).to eq("12345")
        expect(user.github_access_token).to eq("secret-token")
        expect(user.github_username).to eq("myuser")
      end
    end

    describe "#disconnect_github!" do
      it "clears all GitHub fields" do
        user.connect_github!(uid: "12345", access_token: "secret-token", username: "myuser")
        user.disconnect_github!

        expect(user.github_uid).to be_nil
        expect(user.github_access_token).to be_nil
        expect(user.github_username).to be_nil
      end
    end

    describe "access_token encryption" do
      it "encrypts the access token" do
        user.connect_github!(uid: "12345", access_token: "super-secret-token", username: "myuser")

        raw_value = ActiveRecord::Base.connection.execute(
          "SELECT github_access_token FROM users WHERE id = #{user.id}"
        ).first["github_access_token"]

        expect(raw_value).not_to eq("super-secret-token")
        expect(user.github_access_token).to eq("super-secret-token")
      end
    end
  end
end
