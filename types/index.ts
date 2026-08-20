export type Role = "owner" | "assistant";

export type Organization = {
  id: string;
  name: string;
  logoPath: string | null;
  currency: string;
  timezone: string;
};

export type Membership = {
  id: string;
  organizationId: string;
  role: Role;
  displayName: string | null;
};

export type MembershipWithOrganization = Membership & {
  organization: Organization;
};

export type CurrentUser = {
  id: string;
  email: string;
};
