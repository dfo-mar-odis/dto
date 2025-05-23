# Generated by Django 4.2.20 on 2025-05-01 14:22

from django.db import migrations, models

class Migration(migrations.Migration):

    dependencies = [
        ('core', '0006_remove_mpazone_reglement_remove_mpazone_regulation_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='Indicator',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=50, verbose_name='Indicator Name')),
            ],
        ),
        migrations.RemoveField(
            model_name='timeseries',
            name='climatology',
        ),
        migrations.AlterField(
            model_name='timeseries',
            name='temperature',
            field=models.FloatField(verbose_name='Value'),
        ),
        migrations.DeleteModel(
            name='Station',
        ),
        migrations.DeleteModel(
            name='StationLookup',
        ),
    ]
