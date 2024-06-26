// ----- Types
import { type Provider } from "../../types";
import type { RequestPayload, VerifiedPayload, ProviderContext, PROVIDER_ID } from "@gitcoin/passport-types";
import axios from "axios";
import { handleProviderAxiosError } from "../../utils/handleProviderAxiosError";

export type ModelResponse = {
  data: {
    human_probability: number;
    gas_spent: number;
    n_days_active: number;
    n_transactions: number;
  };
};

type ETHAnalysis = {
  humanProbability: number;
  gasSpent: number;
  numberDaysActive: number;
  numberTransactions: number;
};

export type ETHAnalysisContext = ProviderContext & {
  ethAnalysis?: ETHAnalysis;
};

const dataScienceEndpoint = process.env.DATA_SCIENCE_API_URL;

export async function getETHAnalysis(address: string, context: ETHAnalysisContext): Promise<ETHAnalysis> {
  if (!context?.ethAnalysis) {
    const { data } = await fetchModelData<ModelResponse>(address, "eth-stamp-v2-predict");

    context.ethAnalysis = {
      humanProbability: data.human_probability,
      gasSpent: data.gas_spent,
      numberDaysActive: data.n_days_active,
      numberTransactions: data.n_transactions,
    };
  }
  return context.ethAnalysis;
}

export async function fetchModelData<T>(address: string, url_subpath: string): Promise<T> {
  try {
    const response = await axios.post(`http://${dataScienceEndpoint}/${url_subpath}`, {
      address,
    });
    return response.data as T;
  } catch (e) {
    handleProviderAxiosError(e, "model data (" + url_subpath + ")", [dataScienceEndpoint]);
  }
}

export type EthOptions = {
  type: PROVIDER_ID;
  minimum: number;
  dataKey: keyof ETHAnalysis;
  failureMessageFormatter: (minimum: number, actual: number) => string;
};

export class AccountAnalysis implements Provider {
  type: PROVIDER_ID;
  minimum: number;
  dataKey: keyof ETHAnalysis;
  failureMessageFormatter: (minimum: number, actual: number) => string;

  // construct the provider instance with supplied options
  constructor(options: EthOptions) {
    this.type = options.type;
    this.minimum = options.minimum;
    this.dataKey = options.dataKey;
    this.failureMessageFormatter = options.failureMessageFormatter;
  }

  async verify(payload: RequestPayload, context: ETHAnalysisContext): Promise<VerifiedPayload> {
    const { address } = payload;
    const ethAnalysis = await getETHAnalysis(address, context);
    const value = ethAnalysis[this.dataKey];

    if (value < this.minimum) {
      return {
        valid: false,
        errors: [this.failureMessageFormatter(this.minimum, value)],
      };
    }

    return {
      valid: true,
      record: {
        address,
      },
    };
  }
}

class HumanProbabilityProvider extends AccountAnalysis {
  constructor(props: Omit<EthOptions, "dataKey" | "failureMessageFormatter">) {
    super({
      ...props,
      dataKey: "humanProbability",
      failureMessageFormatter: (minimum: number, actual: number) =>
        `You received a score of ${actual} from our analysis. You must have a score of ${minimum} or higher to obtain this stamp.`,
    });
  }
}

export class ETHEnthusiastProvider extends HumanProbabilityProvider {
  constructor() {
    super({
      type: "ETHScore#50",
      minimum: 50,
    });
  }
}

export class ETHAdvocateProvider extends HumanProbabilityProvider {
  constructor() {
    super({
      type: "ETHScore#75",
      minimum: 75,
    });
  }
}

export class ETHMaxiProvider extends HumanProbabilityProvider {
  constructor() {
    super({
      type: "ETHScore#90",
      minimum: 90,
    });
  }
}

export class EthDaysActiveProvider extends AccountAnalysis {
  constructor() {
    super({
      type: "ETHDaysActive#50",
      minimum: 50,
      dataKey: "numberDaysActive",
      failureMessageFormatter: (minimum: number, actual: number) =>
        `You have been active on Ethereum on ${actual} distinct days. You must be active for ${minimum} days to obtain this stamp.`,
    });
  }
}

export class EthGasSpentProvider extends AccountAnalysis {
  constructor() {
    super({
      type: "ETHGasSpent#0.25",
      minimum: 0.25,
      dataKey: "gasSpent",
      failureMessageFormatter: (minimum: number, actual: number) =>
        `You have spent ${actual} ETH on Ethereum gas. You must spend ${minimum} ETH on gas to obtain this stamp.`,
    });
  }
}

export class EthTransactionsProvider extends AccountAnalysis {
  constructor() {
    super({
      type: "ETHnumTransactions#100",
      minimum: 100,
      dataKey: "numberTransactions",
      failureMessageFormatter: (minimum: number, actual: number) =>
        `You have made ${actual} transactions on Ethereum. You must make ${minimum} transactions to obtain this stamp.`,
    });
  }
}
