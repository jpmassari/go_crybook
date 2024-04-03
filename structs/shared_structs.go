package structs

type Signal struct {
	Kind         string      // Type of the signal
	Payload      interface{} // Payload of the signal, can be of any type
	Dt           float64
	Symbol       string
	PredictSteps int
}

type Kline struct {
	StartTime string
	EndTime   string
	Open      string
	Close     string
	High      string
	Low       string
	Symbol    string
}
