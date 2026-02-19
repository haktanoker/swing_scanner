export type CoinRow = {
  symbol: string;
  price?: number;
  change24h?: number;
  volume?: number;
  funding?: number;

  rsi_1h?: number | null;
  rsi_4h?: number | null;
  rsi_1d?: number | null;
  rsi_sma_1h?: number | null;
  rsi_sma_4h?: number | null;
  rsi_sma_1d?: number | null;

  stoch_k_1h?: number | null;
  stoch_d_1h?: number | null;
  stoch_k_4h?: number | null;
  stoch_d_4h?: number | null;
  stoch_k_1d?: number | null;
  stoch_d_1d?: number | null;

  ha_1h?: "green" | "red" | "red_to_green" | "green_to_red" | null;
  ha_4h?: "green" | "red" | "red_to_green" | "green_to_red" | null;
  ha_1d?: "green" | "red" | "red_to_green" | "green_to_red" | null;

  score?: number;
  is_new?: boolean;
  score_details?: Record<string, boolean>;
  max_supply?: number | null;
  circulating_supply?: number | null;
  circulating_ratio?: number | null;

  rsi_cross_up_1h_recent?: boolean;
  rsi_cross_down_1h_recent?: boolean;
  rsi_cross_up_4h_recent?: boolean;
  rsi_cross_down_4h_recent?: boolean;
  rsi_cross_up_1d_recent?: boolean;
  rsi_cross_down_1d_recent?: boolean;

  stoch_cross_up_1h_recent?: boolean;
  stoch_cross_down_1h_recent?: boolean;
  stoch_cross_up_4h_recent?: boolean;
  stoch_cross_down_4h_recent?: boolean;
  stoch_cross_up_1d_recent?: boolean;
  stoch_cross_down_1d_recent?: boolean;
};
