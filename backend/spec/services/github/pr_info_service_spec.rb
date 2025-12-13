# frozen_string_literal: true

RSpec.describe Github::PrInfoService do
  let(:user) { create(:user) }
  let(:service) { described_class.new(user: user) }

  describe "#parse_pr_url" do
    it "parses valid GitHub PR URLs" do
      result = service.parse_pr_url("https://github.com/antiwork/flexile/pull/242")

      expect(result).to eq(owner: "antiwork", repo: "flexile", number: 242)
    end

    it "returns nil for invalid URLs" do
      expect(service.parse_pr_url("https://github.com/antiwork/flexile")).to be_nil
      expect(service.parse_pr_url("https://gitlab.com/antiwork/flexile/pull/242")).to be_nil
      expect(service.parse_pr_url("invalid-url")).to be_nil
    end
  end

  describe "#parse_issue_url" do
    it "parses valid GitHub issue URLs" do
      result = service.parse_issue_url("https://github.com/antiwork/flexile/issues/100")

      expect(result).to eq(owner: "antiwork", repo: "flexile", number: 100)
    end

    it "returns nil for invalid URLs" do
      expect(service.parse_issue_url("https://github.com/antiwork/flexile")).to be_nil
    end
  end

  describe "#extract_bounty_from_labels" do
    it "extracts bounty amount from $100 label" do
      labels = [{ name: "$100" }]
      expect(service.extract_bounty_from_labels(labels)).to eq(10000)
    end

    it "extracts bounty amount from $1,500 label" do
      labels = [{ name: "bounty: $1,500" }]
      expect(service.extract_bounty_from_labels(labels)).to eq(150000)
    end

    it "extracts bounty amount from $50.00 label" do
      labels = [{ name: "$50.00" }]
      expect(service.extract_bounty_from_labels(labels)).to eq(5000)
    end

    it "returns nil when no bounty label found" do
      labels = [{ name: "bug" }, { name: "enhancement" }]
      expect(service.extract_bounty_from_labels(labels)).to be_nil
    end

    it "returns nil for empty labels" do
      expect(service.extract_bounty_from_labels([])).to be_nil
      expect(service.extract_bounty_from_labels(nil)).to be_nil
    end
  end

  describe "#check_pr_paid_status" do
    let(:company) { create(:company) }
    let(:invoice) { create(:invoice, company: company, status: Invoice::PAID) }

    it "returns paid info when PR has been paid" do
      create(:invoice_line_item, invoice: invoice, github_pr_url: "https://github.com/org/repo/pull/1")

      result = service.check_pr_paid_status("https://github.com/org/repo/pull/1", company: company)

      expect(result).to be_present
      expect(result[:paid]).to be true
      expect(result[:invoices]).to be_present
    end

    it "returns nil when PR has not been paid" do
      result = service.check_pr_paid_status("https://github.com/org/repo/pull/999", company: company)

      expect(result).to be_nil
    end

    it "does not return unpaid invoices" do
      unpaid_invoice = create(:invoice, company: company, status: Invoice::RECEIVED)
      create(:invoice_line_item, invoice: unpaid_invoice, github_pr_url: "https://github.com/org/repo/pull/2")

      result = service.check_pr_paid_status("https://github.com/org/repo/pull/2", company: company)

      expect(result).to be_nil
    end
  end

  describe "#pr_belongs_to_company_org?" do
    let(:company) { create(:company) }

    context "when company has active github integration" do
      let!(:github_integration) do
        create(:github_integration, company: company, organization_name: "antiwork", status: GithubIntegration::ACTIVE)
      end

      it "returns true for matching org" do
        result = service.pr_belongs_to_company_org?("https://github.com/antiwork/flexile/pull/1", company: company)
        expect(result).to be true
      end

      it "returns true for case-insensitive match" do
        result = service.pr_belongs_to_company_org?("https://github.com/Antiwork/flexile/pull/1", company: company)
        expect(result).to be true
      end

      it "returns false for different org" do
        result = service.pr_belongs_to_company_org?("https://github.com/other-org/flexile/pull/1", company: company)
        expect(result).to be false
      end
    end

    context "when company has no github integration" do
      it "returns false" do
        result = service.pr_belongs_to_company_org?("https://github.com/antiwork/flexile/pull/1", company: company)
        expect(result).to be false
      end
    end
  end
end
