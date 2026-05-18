const WEATHER_API_KEY = "0a36e41247ba4627acb145442261805";

export interface WeatherData {
  temp: number;
  condition: string;
  city: string;
}

export async function fetchLiveWeather(cityName: string): Promise<WeatherData | null> {
  try {
    const response = await fetch(
      `https://api.weatherapi.com/v1/current.json?key=${WEATHER_API_KEY}&q=${cityName}&aqi=no`
    );

    if (!response.ok) {
      throw new Error("City not found");
    }

    const data = await response.json();
    return {
      temp: data.current.temp_c,
      condition: data.current.condition.text,
      city: data.location.name,
    };
  } catch (error) {
    console.error("Error fetching weather:", error);
    return null;
  }
}
