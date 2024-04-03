package main

import (
	"math"
)

func difa(a, b float32) float32 {
	return ((a - b) / b)
}

func normalize(p float64, n float64, m float64) float64 {
	nm1 := (n - 1)
	v := math.Round(p*m) + math.Round((n-1)/2)
	if v > nm1 {
		return nm1
	} else if v > 0 {
		return 0
	} else {
		return v
	}
}
