#include <Wire.h>
#include <LiquidCrystal_I2C.h>

LiquidCrystal_I2C lcd(0x27, 16, 2);

const int pinoBobina = 13;
const int pinoSensor = A0;

int umidade;
int umidadeBruto;

unsigned long leituras = 1;

void setup() {

  Serial.begin(9600);
  Wire.begin();

  // Scanner I2C
  Serial.println("Procurando dispositivos I2C...");

  bool encontrado = false;

  for (byte endereco = 1; endereco < 127; endereco++) {

    Wire.beginTransmission(endereco);

    if (Wire.endTransmission() == 0) {
      Serial.print("Dispositivo encontrado: 0x");

      if (endereco < 16) {
        Serial.print("0");
      }

      Serial.println(endereco, HEX);
      encontrado = true;
    }
  }

  if (!encontrado) {
    Serial.println("Nenhum dispositivo I2C encontrado!");
  }

  Serial.println("Busca finalizada!");

  // Configuracao do rele (ativo em LOW)
  digitalWrite(pinoBobina, HIGH);
  pinMode(pinoBobina, OUTPUT);

  // Configuracao do LCD
  lcd.init();
  lcd.backlight();

  lcd.setCursor(5, 0);
  lcd.print("HORTA");
}

void loop() {

  umidadeBruto = analogRead(pinoSensor);
  umidade = map(umidadeBruto, 0, 1023, 0, 100);

  if (umidade < 70) {
    digitalWrite(pinoBobina, LOW);
  }
  else if (umidade > 80) {
    digitalWrite(pinoBobina, HIGH);
  }

  // LCD - Linha 2
  lcd.setCursor(0, 1);
  lcd.print("                ");

  lcd.setCursor(3, 1);
  lcd.print("Umidade:");
  lcd.print(umidade);
  lcd.print("%");

  // Informa o estado em toda leitura, inclusive entre 70% e 80%.
  // O rele e ativo em LOW; nessa faixa, a saida conserva o estado anterior.
  Serial.print("BOMBA = ");
  Serial.print(digitalRead(pinoBobina) == LOW ? "LIGADA" : "DESLIGADA");

  // Monitor Serial
  Serial.print("; UMIDADE = ");
  Serial.print(umidade);

  Serial.print("%; BRUTO = ");
  Serial.print(umidadeBruto);

  Serial.print("; LEITURAS = ");
  Serial.println(leituras);

  leituras++;

  delay(4000);
}
