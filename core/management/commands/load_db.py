import logging

from django.core.management.base import BaseCommand
from scripts import setup_init

logger = logging.getLogger('django')

class Command(BaseCommand):

    help = "Runs the initial setup of the database loading polygons and timeseries data"

    def handle(self, *args, **options):

        logger.debug("Loading database")

        setup_init.setup()

        logger.debug("Loading database complete")
