import pandas as pd


def calculate_rsi(series: pd.Series, period: int = 14) -> pd.Series:
    delta = series.diff()

    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)

    avg_gain = gain.rolling(period).mean()
    avg_loss = loss.rolling(period).mean()

    rsi = pd.Series(index=series.index, dtype=float)

    for i in range(period, len(series)):
        if i == period:
            avg_gain_i = avg_gain.iloc[i]
            avg_loss_i = avg_loss.iloc[i]
        else:
            avg_gain_i = (avg_gain_i * (period - 1) + gain.iloc[i]) / period
            avg_loss_i = (avg_loss_i * (period - 1) + loss.iloc[i]) / period

        rs = avg_gain_i / avg_loss_i if avg_loss_i != 0 else 0
        rsi.iloc[i] = 100 - (100 / (1 + rs))

    return rsi


def calculate_sma(series: pd.Series, period: int = 14) -> pd.Series:
    return series.rolling(period).mean()


def calculate_heikin_ashi_state(df: pd.DataFrame) -> str:
    """
    Dönen değerler:
    - "green"
    - "red"
    - "red_to_green"
    - "green_to_red"
    """

    ha_close = (df["open"] + df["high"] + df["low"] + df["close"]) / 4
    ha_open = [(df["open"].iloc[0] + df["close"].iloc[0]) / 2]

    for i in range(1, len(df)):
        ha_open.append((ha_open[i - 1] + ha_close.iloc[i - 1]) / 2)

    # Son 3 mumun rengi
    colors = []
    for i in range(-3, 0):
        if ha_close.iloc[i] > ha_open[i]:
            colors.append("green")
        else:
            colors.append("red")

    # 🔴🔴🟢 → bullish dönüş
    if colors[0] == "red" and colors[1] == "red" and colors[2] == "green":
        return "red_to_green"

    # 🟢🟢🔴 → bearish dönüş
    if colors[0] == "green" and colors[1] == "green" and colors[2] == "red":
        return "green_to_red"

    return colors[-1]


def calculate_stoch_rsi(
    rsi_series: pd.Series,
    period: int = 14,
    smooth_k: int = 3,
    smooth_d: int = 3,
):
    min_rsi = rsi_series.rolling(period).min()
    max_rsi = rsi_series.rolling(period).max()

    stoch_rsi = (rsi_series - min_rsi) / (max_rsi - min_rsi) * 100

    k = stoch_rsi.rolling(smooth_k).mean()
    d = k.rolling(smooth_d).mean()

    return k, d
