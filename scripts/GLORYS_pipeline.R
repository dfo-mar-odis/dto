# R script to download and process Copernicus Marine bottom temperature data (GLORYS)
# This script should be run with the working directory set to dto/core/scripts/
# See note about username and password on line 36 if running for the first time
require(arcpullr)
require(reticulate)
require(stars)
require(sf)
require(dplyr)


# Get MPA, OECMs, AOIs, and draft sites -----------------------------------


# draft sites open data page:
# https://open.canada.ca/data/en/dataset/bb048082-bc05-4588-b4f0-492b1f1b8737
sites <- get_spatial_layer("https://egisp.dfo-mpo.gc.ca/arcgis/rest/services/open_data_donnees_ouvertes/draft_conservation_network_sites/MapServer/0") |>
  st_make_valid()

planning_areas <- get_spatial_layer("https://egisp.dfo-mpo.gc.ca/arcgis/rest/services/open_data_donnees_ouvertes/eastern_canada_marine_spatial_planning_areas/MapServer/0",
                                 where="NAME_E='Scotian Shelf and Bay of Fundy'")


# get python env ready ----------------------------------------------------


pythonenv <- try(reticulate::use_virtualenv("CopernicusMarine", required = TRUE))

if (inherits(pythonenv, "try-error")) {
  reticulate::virtualenv_create(envname = "CopernicusMarine")
  reticulate::virtualenv_install("CopernicusMarine", packages = c("copernicusmarine"))
}
reticulate::use_virtualenv("CopernicusMarine", required = TRUE)
cmt <- try(import("copernicusmarine"))

# Login function to create your configuration file
# looks for environment variables called username and password which contain your login info for the copernicus data store and only has to be done once per machine
if(exists("username")|exists("password")){
  cmt$login(username, password)
}


# define depth bins -------------------------------------------------------
bbox <- st_bbox(st_buffer(planning_areas,10))

cmt$subset(
  dataset_id="cmems_mod_glo_phy_my_0.083deg_P1D-m",
  variables=list("thetao"),
  minimum_longitude=bbox[1],
  maximum_longitude=bbox[3],
  minimum_latitude=bbox[2],
  maximum_latitude=bbox[4],
  start_datetime="2000-01-01T00:00:00",
  end_datetime="2000-01-01T23:59:59",
  output_directory = "data/GLORYS",
  output_filename = "depth.nc"
)

depth <- stars::read_ncdf("data/GLORYS/depth.nc",var="thetao")

depthclass <- st_apply(
  depth,
  MARGIN = c("longitude", "latitude"),  # dimensions to keep
  FUN = function(x) {
    if (all(is.na(x))) {
      return(NA)
    } else {
      return(st_get_dimension_values(depth,"depth")[sum(!is.na(x))])
    }
  }
)

names(depthclass) <- "depth_class"
plot(depthclass)
# download bottom data -----------------------------------------------------------

cmt$subset(
  dataset_id="cmems_mod_glo_phy_my_0.083deg_P1D-m",
  variables=list("bottomT"),
  minimum_longitude=bbox[1],
  maximum_longitude=bbox[3],
  minimum_latitude=bbox[2],
  maximum_latitude=bbox[4],
  start_datetime="1992-12-31T00:00:00",
  end_datetime=format(Sys.time(), "%Y-%m-%dT%H:%M:%S"),
  output_directory = "data/GLORYS",
  output_filename = "bottomT.nc"
)

cmt$subset(
  dataset_id="cmems_mod_glo_phy_myint_0.083deg_P1D-m",
  variables=list("bottomT"),
  minimum_longitude=bbox[1],
  maximum_longitude=bbox[3],
  minimum_latitude=bbox[2],
  maximum_latitude=bbox[4],
  start_datetime="1992-12-31T00:00:00",
  end_datetime=format(Sys.time(), "%Y-%m-%dT%H:%M:%S"),
  output_directory = "data/GLORYS",
  output_filename = "bottomTint.nc"
)

bottom <- c(stars::read_ncdf("data/GLORYS/bottomT.nc",var = "bottomT", proxy = FALSE),
            stars::read_ncdf("data/GLORYS/bottomTint.nc",var = "bottomT", proxy = FALSE))

# get daily temp means ----------------------------------------------------
regular_grid <- st_warp(bottom, crs = st_crs(bottom))
for(i in seq_along(sites$SiteName_E)){
  print(sites$SiteName_E[i])
  df <- as.data.frame(st_apply(regular_grid[sites[i,]],
                               MARGIN = c("time"),
                               FUN = mean,
                               na.rm = TRUE)) |>
    transmute(Date = time,
              `Bottom Temperature (oC)` = round(mean,3))
  fn <- paste0(sites$OBJECTID[i],"_",
               sites[i,]$SiteName_E |>
                 gsub(" ","_",x=_) |>
                 gsub("/","_",x=_) |>
                 gsub("\\(","_",x=_) |>
                 gsub("\\)","_",x=_) |>
                 gsub(",","_",x=_))

  if(any(!is.na(df$`Bottom Temperature (oC)`))){
    write.csv(df,
            file = paste0("data/GLORYS/avebottomT_", fn, ".csv"),
            row.names = FALSE)
  }
}


# get daily temp means by depth class -------------------------------------
regular_depthclass <- st_warp(depthclass, crs = st_crs(bottom))


for(i in seq_along(sites$SiteName_E)){
  print(sites$SiteName_E[i])
  df <- data.frame(Date = st_get_dimension_values(regular_grid,"time"))
  for(z in sort(round(unique(as.vector(regular_depthclass$depth_class))))){
    if(!is.na(z)){
      mask <- st_apply(regular_depthclass[sites[i,]],
                       MARGIN = c("x","y"),
                       function(x){
                         if_else(is.na(x),
                                 FALSE,
                                 round(x)==z)})

      dfz <- as.data.frame(st_apply(regular_grid[sites[i,]][mask],
                                    MARGIN = c("time"),
                                    FUN = mean,
                                    na.rm = TRUE))
      if(any(!is.na(dfz$mean))){
        df[[paste0("",z," m")]] <- round(dfz$mean,3)
      }

    }
  }
  fn <- paste0(sites$OBJECTID[i],"_",
               sites[i,]$SiteName_E |>
                 gsub(" ","_",x=_) |>
                 gsub("/","_",x=_) |>
                 gsub("\\(","_",x=_) |>
                 gsub("\\)","_",x=_) |>
                 gsub(",","_",x=_))
  if(ncol(df)>1){
    write.csv(df,
              file = paste0("data/GLORYS/depth_avebottomT_", fn, ".csv"),
              row.names = FALSE)
  }


}
