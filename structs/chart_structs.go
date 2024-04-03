package structs

type Candle struct {
	Open   float32
	Close  float32
	High   float32
	Low    float32
	Symbol string
}

type Candles struct {
	Candles []Candle
}

type Chart struct {
	Candles Candles
}
