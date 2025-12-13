# frozen_string_literal: true

FactoryBot.define do
  factory :github_integration do
    company
    organization_name { "antiwork" }
    organization_id { 12345 }
    status { GithubIntegration::ACTIVE }

    trait :inactive do
      status { GithubIntegration::INACTIVE }
    end
  end
end
