package chart

import (
	"fmt"
	"math"
	"structs"

	rl "github.com/gen2brain/raylib-go/raylib"

	//"time"
	"strconv"
)

/* type Candle struct {
	StartTime string
	EndTime   string
	Open      string
	Close     string
	High      string
	Low       string
	Symbol    string
} */

func toFloat32(open, close, high, low string) (float32, float32, float32, float32) {
	openf, err := strconv.ParseFloat(open, 32)
	if err != nil {
		fmt.Println("Error:", err)
	}
	closef, err := strconv.ParseFloat(close, 32)
	if err != nil {
		fmt.Println("Error:", err)
	}
	highf, err := strconv.ParseFloat(high, 32)
	if err != nil {
		fmt.Println("Error:", err)
	}
	lowf, err := strconv.ParseFloat(low, 32)
	if err != nil {
		fmt.Println("Error:", err)
	}
	return float32(openf), float32(closef), float32(highf), float32(lowf)
}

// var candles = [...]structs.Kline{}
var candles = [64]structs.Candle{}
var predictSteps = 0

const screenWidth = 800
const screenHeight = 450
const marginY = 50

func Chart(chChart <-chan *structs.Signal) {
	rl.InitWindow(screenWidth, screenHeight, "raylib [core] example - basic window")
	defer rl.CloseWindow()

	//rl.SetTargetFPS(60)
	// Access the map after all goroutines have finished sending data
	//candles, ok := <-chChart

	for signal := range chChart {
		if rl.WindowShouldClose() {
			return
		}
		switch signal.Kind {
		case "Map":
			/* candles.Open = signal.Payload
			signal.Payload.(map[string][]structs.Kline) */
			fmt.Println("Received a map:", signal.Payload)
			predictSteps = signal.PredictSteps
			candle := structs.Candle{}
			for i, value := range signal.Payload.([]structs.Kline) {
				if value.Symbol == "" {
					break
				}
				candle.Open, candle.Close, candle.High, candle.Low = toFloat32(value.Open, value.Close, value.High, value.Low)
				//candles = append(candles, candle)
				candles[i] = candle
			}
			draw()

		case "EmptyStruct":
			draw()
		default:
			fmt.Println("Unknown signal")
		}
	}
}

func draw() {
	//fmt.Println("candles: ", candles)
	rl.BeginDrawing()

	rl.ClearBackground(rl.Black)
	fmt.Println("draw candles: ", candles)
	lastOpen := float32(0)
	open := float32(screenHeight / 2)
	for i, candle := range candles {
		if i >= predictSteps {
			break
		}
		if i > 0 {
			lastOpen = ((float32(float64(candles[i-1].Open)-float64(candle.Open)) * 100) / candles[i-1].Open) * 100
			open += lastOpen
		}
		x := float32(i * 50)
		// Calculate candle dimensions
		candleWidth := float32(40)
		candleHeight := ((float32(float64(candle.Open)-float64(candle.Close)) * 100) / candle.Open) * 100
		candleMax := ((float32(float64(candle.Open)-float64(candle.High)) * 100) / candle.Open) * 100
		candleLow := ((float32(float64(candle.Open)-float64(candle.Low)) * 100) / candle.Open) * 100

		height := candleHeight
		top := candleMax
		bottom := candleLow
		//candleBottom := screenHeight - (candleOpen - candle.Low)

		if candle.Open < candle.Close {
			/* if open > screenHeight {
				screenAdjust := open - screenHeight
				open -= screenAdjust
			} */
			rect := rl.NewRectangle(x, open, candleWidth, height*-1)
			rl.DrawRectangleRec(rect, rl.Green)
			//rl.DrawRectangleV(rl.NewVector2(x-candleWidth/2, open), rl.NewVector2(x+candleWidth/2, open+height), rl.Green)
			// Draw upper shadow open + height
			rl.DrawLineV(rl.NewVector2(x+candleWidth/2, open+height*-1), rl.NewVector2(x+candleWidth/2, open+top*-1), rl.Green)
			// Draw lower shadow
			rl.DrawLineV(rl.NewVector2(x+candleWidth/2, open), rl.NewVector2(x+candleWidth/2, open+bottom), rl.Green)
		} else if candle.Open > candle.Close {
			/* if candleOpen > screenHeight {
				screenAdjust := candleOpen - screenHeight
				candleOpen = candleOpen - screenAdjust
			} */
			// Draw candlestick body
			rect := rl.NewRectangle(x, open, candleWidth, height)
			rl.DrawRectangleRec(rect, rl.Red)
			// Draw upper shadow
			rl.DrawLineV(rl.NewVector2(x+candleWidth/2, open), rl.NewVector2(x+candleWidth/2, open+top), rl.Red)
			// Draw lower shadow
			rl.DrawLineV(rl.NewVector2(x+candleWidth/2, open+height), rl.NewVector2(x+candleWidth/2, open+bottom), rl.Red)
		} else if math.Abs(float64(height)) < 5 {
			rl.DrawLineV(rl.NewVector2(x+candleWidth/2, open+10), rl.NewVector2(x+candleWidth/2, open-10), rl.White)
			rl.DrawLineV(rl.NewVector2((x+candleWidth/2)+candleWidth/2, open), rl.NewVector2((x+candleWidth/2)-candleWidth/2, open), rl.White)
		}
	}

	//rl.DrawText("Congrats! You created your first window!", 190, 200, 20, rl.LightGray)

	rl.EndDrawing()
}
