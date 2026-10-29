// Household data model. Everything the advisor enters lives here; every figure on screen is derived from it.

export type AssetClass = "us" | "intl" | "bonds" | "realestate" | "alts" | "cash";
export type RiskProfile = "Conservative" | "Moderate" | "Aggressive";
export type FilingStatus = "mfj" | "single" | "hoh";

export type EntityType =
  | "individual" | "joint" | "revocable-trust" | "irrevocable-trust" | "llc" | "foundation" | "daf" | "custodial" | "529";

export type Entity = {
  id: string;
  name: string;
  type: EntityType;
  parent?: string; // entity id that owns or controls it (e.g. an LLC owned by a trust)
  trustee?: string;
  beneficiaries?: string;
  note?: string;
};

export type TaxTreatment = "taxable" | "tax-deferred" | "tax-free" | "tax-exempt";

export type Holding = { symbol: string; shares: number; basis: number; price?: number }; // basis = total cost; price = fallback/last known

export type Account = {
  id: string;
  name: string;
  entity: string;
  custodian: string;
  tax: TaxTreatment;
  /** Accounts managed under the household investment policy (excludes 529s, donor-advised funds and foundations). */
  inPolicy: boolean;
  holdings: Holding[];
  asOf?: string; // date of the last statement or position update
};

export type OtherAssetKind = "residence" | "real-estate" | "private-equity" | "venture" | "business" | "art" | "aircraft" | "other";

export type OtherAsset = {
  id: string;
  name: string;
  kind: OtherAssetKind;
  entity: string;
  value: number;
  asOf: string;
  income?: number; // annual net income it produces
  note?: string;
};

export type LiabilityKind = "mortgage" | "student-loan" | "credit-line" | "auto" | "other";

export type Liability = {
  id: string;
  name: string;
  kind: LiabilityKind;
  entity: string;
  balance: number;
  rate: number;
  payment: number; // monthly
};

export type Person = {
  id: string;
  name: string;
  relationship: "client" | "spouse" | "child" | "grandchild" | "other";
  dob: string;
  income?: number;
  retireAge?: number;
  planToAge?: number;
  ssClaimAge?: number;
  email?: string;
  phone?: string;
  note?: string;
};

export type GoalType = "retirement" | "education" | "home" | "legacy" | "purchase";

export type Goal = {
  id: string;
  type: GoalType;
  name: string;
  year: number;
  amount: number; // today's dollars (per year for education)
  years?: number; // duration in years (education)
  priority: 1 | 2 | 3; // 1 = needs, 2 = wants, 3 = wishes
  person?: string;
};

export type LifeEventType = "job-loss" | "market-crash" | "inflation-spike" | "home-purchase" | "new-child" | "divorce" | "inheritance";

export type LifeEvent = { id: string; type: LifeEventType; year: number; amount?: number; duration?: number; person?: string };

export type PolicyTarget = { cls: AssetClass; target: number; min: number; max: number };

export type IPS = {
  effective: string;
  lastReview: string;
  profile: RiskProfile;
  objective: string;
  returnTarget: number; // nominal, annual
  timeHorizon: string;
  liquidityMonths: number;
  taxNotes: string;
  legalNotes: string;
  unique: string;
  targets: PolicyTarget[];
  benchmark: string;
  rebalancing: string;
  limits: { maxVolatility: number; maxDrawdown: number; maxPosition: number; maxIlliquid: number };
  spending: string;
  advisoryFee: number;
  approvedBy: string;
  changes?: { date: string; summary: string }[];
};

export type NoteCategory = "Meeting" | "Call" | "Email" | "Recommendation" | "Follow-up" | "Review";
export type Note = { id: string; date: string; category: NoteCategory; summary: string; author: string };
export type Task = { id: string; title: string; due: string; done: boolean; priority: "High" | "Normal" };
export type DocStatus = "Awaiting signature" | "Signed" | "Review due";
export type Doc = { id: string; name: string; status: DocStatus; date: string };

export type Household = {
  id: string;
  name: string;
  tier: "Ultra-high net worth" | "High net worth" | "Mass affluent";
  state: string;
  filing: FilingStatus;
  marital: "Married" | "Single" | "Divorced" | "Widowed";
  advisor: string;
  since: string;
  people: Person[];
  expenses: number; // annual living expenses, today's dollars
  savings: number; // annual additions to the portfolio while working
  retirementSpending: number; // annual, today's dollars
  otherIncome: number; // pensions, rental income etc. in retirement, annual
  entities: Entity[];
  accounts: Account[];
  other: OtherAsset[];
  liabilities: Liability[];
  goals: Goal[];
  events: LifeEvent[];
  ips: IPS;
  riskAnswers?: Record<string, number>;
  preferences: string[];
  notes: Note[];
  tasks: Task[];
  documents?: Doc[];
  exemptionUsed?: number; // lifetime gift and estate exclusion already used by taxable gifts
  beneficiaryReview?: string; // when beneficiary designations were last confirmed
  nextMeeting?: string;
  lastReview?: { date: string; probability: number; netWorth: number };
};
