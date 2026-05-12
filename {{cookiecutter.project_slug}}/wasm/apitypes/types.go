package apitypes

type Entry struct {
	ID        int64  `json:"id"`
	Name      string `json:"name"`
	StartedAt int64  `json:"started_at"`
	EndedAt   *int64 `json:"ended_at"`
	CreatedAt int64  `json:"created_at"`
}
