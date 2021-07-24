package main

import (
	"encoding/json"
	"fmt"
	request "github.com/hunterbdm/hello-requests"
	"log"
	"net/http"
	"strconv"
)

func main() {
	fs := http.FileServer(http.Dir("./content"))
	http.Handle("/", fs)
	http.HandleFunc("/api", api)

	log.Println("Listening on :3000...")
	err := http.ListenAndServe(":3000", nil)
	if err != nil {
		log.Fatal(err)
	}
}

type APIResponse struct {
	Success bool  `json:"success"`
	Error string  `json:"error,omitempty"`
	Cops []*Alert `json:"cops"`
}

type Alert struct {
	Type string `json:"type"`
	SubType string `json:"subtype,omitempty"`
	Location LocationData `json:"location"`
	Street string `json:"street,omitempty"`
}

type LocationData struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
}

func api(w http.ResponseWriter, req *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	long := req.URL.Query().Get("long")
	lat := req.URL.Query().Get("lat")

	if lat == "" || long == "" {
		w.WriteHeader(400)
		res, _ := json.Marshal(APIResponse{
			Success: false,
			Error:   "missing required fields",
		})
		_, _ = w.Write(res)
	} else {
		longf64, err := strconv.ParseFloat(long, 64)
		latf64, err := strconv.ParseFloat(lat, 64)
		if err != nil {
			res, _ := json.Marshal(APIResponse{
				Success: false,
				Error:   "bad inputs man",
			})
			_, _ = w.Write(res)
			return
		}

		wazeData, err := pullWazeData(longf64, latf64)
		if err != nil {
			res, _ := json.Marshal(APIResponse{
				Success: false,
				Error:   err.Error(),
			})
			_, _ = w.Write(res)
			return
		}

		var policeData []*Alert
		for i := range wazeData {
			if wazeData[i].Type == "POLICE" {
				policeData = append(policeData, wazeData[i])
			}
		}


		w.WriteHeader(200)
		res, _ := json.Marshal(APIResponse{
			Success: true,
			Cops: policeData,
		})
		_, _ = w.Write(res)
	}
}

func pullWazeData(long, lat float64) ([]*Alert, error) {
	left := fmt.Sprintf("%.5f", long - 0.1)
	right := fmt.Sprintf("%.5f", long + 0.1)
	top := fmt.Sprintf("%.5f", lat + 0.1)
	bottom := fmt.Sprintf("%.5f", lat - 0.1)

	resp, err := request.Do(request.Options{
		URL:               "https://teslawaze.azurewebsites.net/waze.ashx?https://www.waze.com/rtserver/web/TGeoRSS?ma=600&left="+left+"&right="+right+"&bottom="+bottom+"&top="+top+"&types=alerts",
		Headers:           request.Headers{
			"user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
			"referer": "https://teslawaze.azurewebsites.net/scripts/wazeworker.js?ver1",
		},
	})

	if err != nil {
		return nil, err
	}

	dataParsed := struct {
		Alerts []*Alert
	}{}

	err = json.Unmarshal([]byte(resp.Body), &dataParsed)
	if err != nil {
		return nil, err
	}

	return dataParsed.Alerts, nil
}