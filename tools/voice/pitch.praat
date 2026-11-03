form args
  sentence in
  sentence out
  real k 1.5
  real up 1
endform
s = Read from file: in$
p = To Pitch: 0.01, 75, 500
med = Get quantile: 0, 0, 0.5, "Hertz"
selectObject: s
m = To Manipulation: 0.01, 75, 500
t = Extract pitch tier
Stylize: 1.5, "Semitones"
kk = 1 + (k - 1) * 0.75
Formula: "'med'*'up'*(self/'med')^'kk'"
selectObject: m
plusObject: t
Replace pitch tier
selectObject: m
r = Get resynthesis (overlap-add)
Save as WAV file: out$
