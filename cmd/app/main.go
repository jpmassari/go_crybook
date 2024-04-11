package main

import (
	"context"
	"errors"
	"fmt"
	"io/fs"
	"log"
	"os"
	"sync"
	"time"

	"chart"
	"structs"

	"github.com/adshao/go-binance/v2"
)

const (
	targetFPS       = 60                      // Target frames per second
	targetFrameTime = time.Second / targetFPS // Target frame time
)

type SafeMap struct {
	mu   sync.RWMutex
	data map[string][]structs.Kline
}

func (sm *SafeMap) Write(key string, candle structs.Kline) {
	sm.mu.Lock()
	defer sm.mu.Unlock()
	sm.data[key] = append(sm.data[key], candle)
}

func (sm *SafeMap) NumReadS(key string, limit int) []structs.Kline {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	result := make([]structs.Kline, limit)
	count := 0
	for i, value := range sm.data[key] {
		result[i] = value
		count++
		if count >= limit {
			break
		}
	}
	return result
}

func (sm *SafeMap) Read() *SafeMap {
	sm.mu.Lock()
	defer sm.mu.Unlock()
	return sm
}

func formatTime(ufTime [2]int64) (string, string) {
	tmStart := time.Unix(ufTime[0], 0)
	tmEnd := time.Unix(ufTime[1], 0)
	return tmStart.Format("15:04:05"), tmEnd.Format("15:04:05")
}

func setCandle(kline *binance.WsKline) structs.Kline {
	startTime, endTime := formatTime([2]int64{int64(kline.StartTime / 1000), int64(kline.EndTime / 1000)})

	candle := structs.Kline{
		StartTime: startTime,
		EndTime:   endTime,
		Open:      kline.Open,
		Close:     kline.Close,
		High:      kline.High,
		Low:       kline.Low,
		Symbol:    kline.Symbol,
	}
	return candle
}

func isCandleNew(candleMap map[string][]structs.Kline, candle structs.Kline) bool {
	candles := candleMap[candle.Symbol]
	if len(candles) == 0 || candles[len(candles)-1].StartTime != candle.StartTime {
		return true
	}
	return false
}

var wg sync.WaitGroup
var emptySignal = structs.Signal{
	Kind:    "EmptyStruct",
	Payload: struct{}{},
	Dt:      0,
}

func main() {
	client, err := client()
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println("client: ", client.Logger)
	chChart := make(chan *structs.Signal)
	candleMap := SafeMap{data: make(map[string][]structs.Kline)}
	//var wg sync.WaitGroup
	wsKlineHandler := func(event *binance.WsKlineEvent) {
		candle := setCandle(&event.Kline)
		fmt.Println("Kline: ", candle)
		newCandle := isCandleNew(candleMap.data, candle)
		fmt.Println(newCandle)
		if newCandle {
			//creating sequences of candles
			//candleMap[candle.Symbol] = append(candleMap[candle.Symbol], candle)
			candleMap.Write(candle.Symbol, candle)
			fmt.Println(candleMap.Read())
			//TODO: send signal of the the first coin in the ordered candleMap
			//TODO: order candleMap based on a freq file or another reference
			if candle.Symbol == "BTCUSDT" {
				signal := structs.Signal{
					Kind: "Map",
					//Payload: candleMap.Read().data["DUSKUSDT"],
					//TODO: Get the last elements from candleMap and not the firsts
					Payload:      candleMap.NumReadS(candle.Symbol, 14),
					Symbol:       candle.Symbol,
					PredictSteps: 14,
				}
				chChart <- &signal
			}
		}
	}

	errHandler := func(err error) {
		fmt.Println(err)
	}

	coins := [...]string{"DUSKUSDT", "LINKUSDT", "BTCUSDT"}

	wg.Add(len(coins))
	for _, coin := range coins {
		go func(coin string) {
			doneC, _, err := binance.WsKlineServe(coin, "1m", wsKlineHandler, errHandler)
			fmt.Println(doneC)
			if err != nil {
				fmt.Println(err)
				return
			}
			fmt.Println("oi")
			wg.Done()
			<-doneC
		}(coin)
	}

	fmt.Println("Wait")
	wg.Wait() // Wait for all Goroutines to finish before sending data.
	fmt.Println("after Wait")
	go func() {
		ticker := time.NewTicker(targetFrameTime)
		defer ticker.Stop()
		var prevTime time.Time
		for now := range ticker.C {
			delta := now.Sub(prevTime).Seconds()
			prevTime = now
			/* if delta > maxFrameDeltaTime {
				delta = maxFrameDeltaTime
			} */
			frame(delta, &chChart)
		}
		defer close(chChart)
		defer fmt.Println("chChart WAS CLOSED!")
	}()

	chart.Chart(chChart)

	// Keep the main Goroutine alive
	select {}
}

func client() (*binance.Client, error) {
	keys, err := readBinanceFile()
	if err != nil {
		log.Fatal(err)
	}
	apiKey, secretKey := keys[0], keys[1]
	client := binance.NewClient(string(apiKey), string(secretKey))

	//Set timeset based off binance server
	client.NewServerTimeService().Do(context.Background())
	if client == nil {
		return nil, errors.New("failed to stablish client connection")
	}
	return client, nil
}

func readBinanceFile() ([2]string, error) {
	bytes, err := fs.ReadFile(os.DirFS("."), "key.txt")
	if err != nil {
		return [2]string{"", ""}, errors.New("no key.txt file was found")
	}

	byteArray := [2][]byte{}
	temp := []byte{}
	w := 0
	for _, b := range bytes {
		if b == 13 {
			byteArray[w] = temp
			temp = []byte{}
			if w < 1 {
				w += 1
			}
			continue
		}
		temp = append(temp, b)
	}
	if byteArray[w] == nil {
		byteArray[w] = temp
	}

	apiKey, secretKey := string(byteArray[0]), string(byteArray[1])
	return [2]string{apiKey, secretKey}, nil
}

func frame(dt float64, chChart *chan *structs.Signal) {
	emptySignal.Dt = dt
	*chChart <- &emptySignal
}
