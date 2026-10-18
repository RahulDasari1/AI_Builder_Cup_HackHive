FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY backend/Shared backend/Shared
COPY backend/Services/Reports.Api backend/Services/Reports.Api
RUN dotnet publish backend/Services/Reports.Api/Reports.Api.csproj -c Release -o /out

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
ENV ASPNETCORE_URLS=http://0.0.0.0:8080
EXPOSE 8080
COPY --from=build /out .
ENTRYPOINT ["dotnet", "Reports.Api.dll"]